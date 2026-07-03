import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initialSync, flushQueue, pushChange } from '../syncEngine';
import { createQueue } from '../queue';
import { LocalRepository } from '../../state/local-repository';
import { userKeyPrefix } from '../../state/user-keys';
import type { SupabaseRepository } from '../../state/supabase-repository';
import type { PersistedState } from '../../state/persist';
import type { QueueItem, RepoChange } from '../../state/repo-change';
import type { JournalEntry } from '../../domain/types';

const UID = 'user-1';

function base(over: Partial<PersistedState> = {}): PersistedState {
  return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko', ...over };
}

/** SupabaseRepository의 소비 메서드만 스텁한 mock. */
function makeRemote(loadAllResult: PersistedState = base()) {
  const remote = {
    loadAll: vi.fn().mockResolvedValue(loadAllResult),
    saveGrass: vi.fn().mockResolvedValue(undefined),
    upsertJournal: vi.fn().mockResolvedValue(undefined),
    deleteJournal: vi.fn().mockResolvedValue(undefined),
    upsertDrill: vi.fn().mockResolvedValue(undefined),
    deleteDrill: vi.fn().mockResolvedValue(undefined),
    upsertCollected: vi.fn().mockResolvedValue(undefined),
    deleteCollected: vi.fn().mockResolvedValue(undefined),
    setLang: vi.fn().mockResolvedValue(undefined),
  };
  return remote as unknown as SupabaseRepository & typeof remote;
}

function localRepo() {
  return new LocalRepository({ keyPrefix: userKeyPrefix(UID), seedOnEmpty: false });
}

function qitem(id: string, change: RepoChange): QueueItem {
  return { id, change, updatedAt: '2026-07-01T00:00:00.000Z' };
}

beforeEach(() => localStorage.clear());

describe('pushChange — change → remote method (B5-E2/E3/E4)', () => {
  it('B5-E2: grass → saveGrass({[day]:count}) exact 1-day map', async () => {
    const remote = makeRemote();
    await pushChange(remote, { kind: 'grass', day: '2026-07-01', count: 3 });
    expect(remote.saveGrass).toHaveBeenCalledWith({ '2026-07-01': 3 });
  });

  it('B5-E3: journal upsert → upsertJournal(entry)', async () => {
    const remote = makeRemote();
    const entry: JournalEntry = {
      id: 'j1', date: 'd', title: 't', minutes: 1, chords: [], notes: '',
    };
    await pushChange(remote, { kind: 'journal', op: 'upsert', entry });
    expect(remote.upsertJournal).toHaveBeenCalledWith(entry);
  });

  it('B5-E3: journal delete → deleteJournal(id)', async () => {
    const remote = makeRemote();
    await pushChange(remote, { kind: 'journal', op: 'delete', id: 'j1' });
    expect(remote.deleteJournal).toHaveBeenCalledWith('j1');
  });

  it('B5-E4: drill upsert → upsertDrill(drill, sortOrder)', async () => {
    const remote = makeRemote();
    const drill = { id: 'd1', title: 't', target: 5, count: 2 };
    await pushChange(remote, { kind: 'drill', op: 'upsert', drill, sortOrder: 2 });
    expect(remote.upsertDrill).toHaveBeenCalledWith(drill, 2);
  });

  it('B5-E4: drill delete → deleteDrill(id)', async () => {
    const remote = makeRemote();
    await pushChange(remote, { kind: 'drill', op: 'delete', id: 'd1' });
    expect(remote.deleteDrill).toHaveBeenCalledWith('d1');
  });

  it('B5-E4: collected upsert/delete(name) → upsertCollected/deleteCollected', async () => {
    const remote = makeRemote();
    const chord = { name: 'C', frets: ['x', 3, 2, 0, 1, 0] as (number | 'x')[], key: 'C' };
    await pushChange(remote, { kind: 'collected', op: 'upsert', chord });
    expect(remote.upsertCollected).toHaveBeenCalledWith(chord);
    await pushChange(remote, { kind: 'collected', op: 'delete', name: 'C' });
    expect(remote.deleteCollected).toHaveBeenCalledWith('C');
  });

  it('B5-E4: lang → setLang(lang)', async () => {
    const remote = makeRemote();
    await pushChange(remote, { kind: 'lang', lang: 'en' });
    expect(remote.setLang).toHaveBeenCalledWith('en');
  });
});

describe('initialSync — pull → merge → cache (B5-E1)', () => {
  it('B5-E1: loadAll once → merge → local.saveAll(merged) → returns merged', async () => {
    const server = base({ grass: { d1: 5 }, journal: [
      { id: 'srv', date: 'd', title: 't', minutes: 1, chords: [], notes: '' },
    ] });
    const remote = makeRemote(server);
    const local = localRepo();
    local.setGrass({ d1: 2, d2: 1 }); // local optimistic cache
    const queue = createQueue(UID);

    const merged = await initialSync({ remote, local, queue });

    expect(remote.loadAll).toHaveBeenCalledTimes(1);
    // grass merged max + union
    expect(merged.grass).toEqual({ d1: 5, d2: 1 });
    // server-only journal appears
    expect(merged.journal.map((e) => e.id)).toContain('srv');
    // cache persisted
    expect(local.loadAll().grass).toEqual({ d1: 5, d2: 1 });
  });

  it('applies pending queue deletes during merge', async () => {
    const server = base({ collected: [{ name: 'G', frets: ['x', 2, 0, 0, 0, 3] as (number | 'x')[], key: 'G' }] });
    const remote = makeRemote(server);
    const local = localRepo(); // empty cache
    const queue = createQueue(UID);
    queue.enqueue(qitem('1', { kind: 'collected', op: 'delete', name: 'G' }));

    const merged = await initialSync({ remote, local, queue });
    expect(merged.collected).toEqual([]);
  });
});

describe('flushQueue — push queue items (B5-E5/E6)', () => {
  it('B5-E5: 3 items pushed successfully → queue emptied', async () => {
    const remote = makeRemote();
    const local = localRepo();
    const queue = createQueue(UID);
    queue.enqueue(qitem('1', { kind: 'grass', day: 'd1', count: 1 }));
    queue.enqueue(qitem('2', { kind: 'journal', op: 'delete', id: 'j1' }));
    queue.enqueue(qitem('3', { kind: 'lang', lang: 'en' }));

    await flushQueue({ remote, local, queue });

    expect(remote.saveGrass).toHaveBeenCalledTimes(1);
    expect(remote.deleteJournal).toHaveBeenCalledTimes(1);
    expect(remote.setLang).toHaveBeenCalledTimes(1);
    expect(queue.list()).toEqual([]);
  });

  it('B5-E6: partial failure → only successes removed, failure stays', async () => {
    const remote = makeRemote();
    (remote.deleteJournal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('network'),
    );
    const local = localRepo();
    const queue = createQueue(UID);
    queue.enqueue(qitem('1', { kind: 'grass', day: 'd1', count: 1 }));
    queue.enqueue(qitem('2', { kind: 'journal', op: 'delete', id: 'j1' })); // fails
    queue.enqueue(qitem('3', { kind: 'lang', lang: 'en' }));

    await flushQueue({ remote, local, queue });

    const remaining = queue.list().map((i) => i.id);
    expect(remaining).toEqual(['2']); // failed item stays
  });
});
