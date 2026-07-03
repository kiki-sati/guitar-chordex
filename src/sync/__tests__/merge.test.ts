import { describe, it, expect } from 'vitest';
import { mergePersisted } from '../merge';
import type { PersistedState } from '../../state/persist';
import type { RepoChange } from '../../state/repo-change';
import type {
  CollectedChord,
  Drill,
  JournalEntry,
} from '../../domain/types';

function base(over: Partial<PersistedState> = {}): PersistedState {
  return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko', ...over };
}
const J = (id: string, o: Partial<JournalEntry> = {}): JournalEntry => ({
  id, date: '2026-07-01', title: 't-' + id, minutes: 10, chords: ['C'], notes: '', ...o,
});
const D = (id: string, o: Partial<Drill> = {}): Drill => ({
  id, title: 't-' + id, target: 5, count: 0, ...o,
});
const C = (name: string, o: Partial<CollectedChord> = {}): CollectedChord => ({
  name, frets: ['x', 3, 2, 0, 1, 0], key: name, ...o,
});

describe('mergePersisted — grass (per-day max, union) [B5-M1/M2]', () => {
  it('B5-M1: local {d1:3} + server {d1:2,d2:1} → {d1:3,d2:1}', () => {
    const server = base({ grass: { d1: 2, d2: 1 } });
    const local = base({ grass: { d1: 3 } });
    expect(mergePersisted(server, local).grass).toEqual({ d1: 3, d2: 1 });
  });

  it('B5-M2: reinstall — local {} + server {d1:5} → {d1:5} (server preserved)', () => {
    const server = base({ grass: { d1: 5 } });
    const local = base({ grass: {} });
    expect(mergePersisted(server, local).grass).toEqual({ d1: 5 });
  });

  it('accumulation not lost: local {d1:3} server {d1:2} → {d1:3} (max, no LWW)', () => {
    const server = base({ grass: { d1: 2 } });
    const local = base({ grass: { d1: 3 } });
    expect(mergePersisted(server, local).grass).toEqual({ d1: 3 });
  });
});

describe('mergePersisted — journal (union by id, local wins) [B5-M3/M4]', () => {
  it('B5-M3: local [A] + server [B] → [A,B] (union by id)', () => {
    const server = base({ journal: [J('B')] });
    const local = base({ journal: [J('A')] });
    const ids = mergePersisted(server, local).journal.map((e) => e.id).sort();
    expect(ids).toEqual(['A', 'B']);
  });

  it('B5-M4: same id, differing content → LOCAL WINS (Q1 confirmed)', () => {
    const server = base({ journal: [J('X', { title: 'server-title' })] });
    const local = base({ journal: [J('X', { title: 'local-title' })] });
    const merged = mergePersisted(server, local).journal;
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('local-title');
  });

  it('server-only id appears (other device data)', () => {
    const server = base({ journal: [J('remote')] });
    const local = base({ journal: [] });
    expect(mergePersisted(server, local).journal.map((e) => e.id)).toEqual(['remote']);
  });

  it('local pending delete removes a server entry [local-optimistic delete]', () => {
    const server = base({ journal: [J('X')] });
    const local = base({ journal: [] });
    const pending: RepoChange[] = [{ kind: 'journal', op: 'delete', id: 'X' }];
    expect(mergePersisted(server, local, pending).journal).toEqual([]);
  });
});

describe('mergePersisted — drills (union by id, count max, local meta) [B5-M7]', () => {
  it('B5-M7: same id local.count=5 server.count=3 → 5 (max)', () => {
    const server = base({ drills: [D('d1', { count: 3 })] });
    const local = base({ drills: [D('d1', { count: 5 })] });
    const merged = mergePersisted(server, local).drills;
    expect(merged).toHaveLength(1);
    expect(merged[0].count).toBe(5);
  });

  it('B5-M7 RESET: local.count=0 (explicit reset) but max keeps larger — server.count=4 → 4', () => {
    // NOTE: max rule; RESET intent is preserved only when it is the larger/latest.
    const server = base({ drills: [D('d1', { count: 4 })] });
    const local = base({ drills: [D('d1', { count: 0 })] });
    expect(mergePersisted(server, local).drills[0].count).toBe(4);
  });

  it('drill meta: local wins (title) while count takes max', () => {
    const server = base({ drills: [D('d1', { title: 'server', count: 2 })] });
    const local = base({ drills: [D('d1', { title: 'local', count: 5 })] });
    const merged = mergePersisted(server, local).drills[0];
    expect(merged.title).toBe('local');
    expect(merged.count).toBe(5);
  });

  it('server-only drill appears; union by id', () => {
    const server = base({ drills: [D('d1'), D('d2')] });
    const local = base({ drills: [D('d1')] });
    expect(mergePersisted(server, local).drills.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
  });

  it('local pending delete removes a server drill', () => {
    const server = base({ drills: [D('d1')] });
    const local = base({ drills: [] });
    const pending: RepoChange[] = [{ kind: 'drill', op: 'delete', id: 'd1' }];
    expect(mergePersisted(server, local, pending).drills).toEqual([]);
  });
});

describe('mergePersisted — collected (union by name) [B5-M5/M6]', () => {
  it('B5-M5: local [Cmaj7] + server [G] → [Cmaj7, G] (name union)', () => {
    const server = base({ collected: [C('G')] });
    const local = base({ collected: [C('Cmaj7')] });
    const names = mergePersisted(server, local).collected.map((c) => c.name).sort();
    expect(names).toEqual(['Cmaj7', 'G']);
  });

  it('duplicate name kept once (local wins on frets)', () => {
    const server = base({ collected: [C('C', { frets: [8, 10, 10, 9, 8, 8] })] });
    const local = base({ collected: [C('C', { frets: ['x', 3, 2, 0, 1, 0] })] });
    const merged = mergePersisted(server, local).collected;
    expect(merged).toHaveLength(1);
    expect(merged[0].frets).toEqual(['x', 3, 2, 0, 1, 0]);
  });

  it('B5-M6: local pending delete of a name → excluded from result (local optimistic)', () => {
    const server = base({ collected: [C('G')] });
    const local = base({ collected: [] });
    const pending: RepoChange[] = [{ kind: 'collected', op: 'delete', name: 'G' }];
    expect(mergePersisted(server, local, pending).collected).toEqual([]);
  });
});

describe('mergePersisted — lang (local wins) [B5-M8]', () => {
  it('B5-M8: local lang wins over server', () => {
    const server = base({ lang: 'en' });
    const local = base({ lang: 'ko' });
    expect(mergePersisted(server, local).lang).toBe('ko');
  });
});
