import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncRepo } from '../sync-repository';
import { createQueue } from '../../sync/queue';
import type { SupabaseRepository } from '../supabase-repository';
import type { PersistedState } from '../persist';
import type { RepoChange } from '../repo-change';

const UID = 'user-1';

function base(over: Partial<PersistedState> = {}): PersistedState {
  return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko', ...over };
}

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

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

const GRASS_CHANGE: RepoChange = { kind: 'grass', day: 'd1', count: 1 };

beforeEach(() => {
  localStorage.clear();
  setOnline(true);
});
afterEach(() => setOnline(true));

describe('SyncRepo — loadCached (B5-S1)', () => {
  it('B5-S1: returns empty state immediately when cache empty (no seed)', () => {
    const repo = new SyncRepo({ remote: makeRemote(), userId: UID });
    expect(repo.loadCached()).toEqual(base());
  });

  it('returns cached data synchronously when present', () => {
    // pre-seed the user cache directly
    const pre = new SyncRepo({ remote: makeRemote(), userId: UID });
    void pre.apply([{ kind: 'lang', lang: 'en' }]);
    const repo = new SyncRepo({ remote: makeRemote(), userId: UID });
    expect(repo.loadCached().lang).toBe('en');
  });
});

describe('SyncRepo — apply online (B5-S2)', () => {
  it('B5-S2: merges cache + pushes change, queue stays empty', async () => {
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(remote.saveGrass).toHaveBeenCalledWith({ d1: 1 });
    expect(repo.loadCached().grass).toEqual({ d1: 1 });
    expect(createQueue(UID).list()).toEqual([]);
  });
});

describe('SyncRepo — apply offline (B5-S3)', () => {
  it('B5-S3: offline → merges cache + enqueues, no remote call', async () => {
    setOnline(false);
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(remote.saveGrass).not.toHaveBeenCalled();
    expect(repo.loadCached().grass).toEqual({ d1: 1 });
    const queued = createQueue(UID).list();
    expect(queued).toHaveLength(1);
    expect(queued[0].change).toEqual(GRASS_CHANGE);
  });

  it('online push failure falls back to enqueue (R9)', async () => {
    const remote = makeRemote();
    (remote.saveGrass as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('net'));
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(createQueue(UID).list()).toHaveLength(1);
  });
});

describe('SyncRepo — online event flush (B5-S4)', () => {
  it('B5-S4: online event flushes queue and empties it', async () => {
    setOnline(false);
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(createQueue(UID).list()).toHaveLength(1);

    // come back online
    repo.start(() => {});
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    // allow the async flush microtasks to settle
    await vi.waitFor(() => expect(createQueue(UID).list()).toEqual([]));
    expect(remote.saveGrass).toHaveBeenCalled();
    repo.dispose();
  });
});

describe('SyncRepo — idempotence (B5-S5)', () => {
  it('B5-S5: applying same change twice → cache identical to once (upsert)', async () => {
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    const once = repo.loadCached();
    await repo.apply([GRASS_CHANGE]);
    const twice = repo.loadCached();
    expect(twice).toEqual(once); // grass count is absolute value → same
  });
});

describe('SyncRepo — start / dispose (B5-S6)', () => {
  it('B5-S6: start runs initialSync and notifies onMerged once', async () => {
    const server = base({ grass: { d1: 5 } });
    const remote = makeRemote(server);
    const repo = new SyncRepo({ remote, userId: UID });
    const onMerged = vi.fn();
    repo.start(onMerged);
    await vi.waitFor(() => expect(onMerged).toHaveBeenCalledTimes(1));
    expect(onMerged.mock.calls[0][0].grass).toEqual({ d1: 5 });
    repo.dispose();
  });

  it('dispose removes the online listener (idempotent)', async () => {
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    repo.start(() => {});
    repo.dispose();
    expect(() => repo.dispose()).not.toThrow();
    // after dispose, an online event must not trigger a flush
    (remote.saveGrass as ReturnType<typeof vi.fn>).mockClear();
    setOnline(false);
    await repo.apply(GRASS_CHANGE ? [GRASS_CHANGE] : []);
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    // give any (unexpected) listener a chance
    await new Promise((r) => setTimeout(r, 20));
    expect(remote.saveGrass).not.toHaveBeenCalled();
  });
});
