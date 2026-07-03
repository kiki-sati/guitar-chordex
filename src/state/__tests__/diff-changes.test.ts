import { describe, it, expect } from 'vitest';
import { diffChanges } from '../diff-changes';
import type { PersistedState } from '../persist';
import type { RepoChange } from '../repo-change';
import type {
  CollectedChord,
  Drill,
  JournalEntry,
} from '../../domain/types';

function base(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    grass: {},
    journal: [],
    drills: [],
    collected: [],
    lang: 'ko',
    ...overrides,
  };
}

const J = (id: string, over: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  date: '2026-07-01',
  title: 't-' + id,
  minutes: 10,
  chords: ['C'],
  notes: '',
  ...over,
});

const D = (id: string, over: Partial<Drill> = {}): Drill => ({
  id,
  title: 't-' + id,
  target: 5,
  count: 0,
  ...over,
});

const C = (name: string, over: Partial<CollectedChord> = {}): CollectedChord => ({
  name,
  frets: ['x', 3, 2, 0, 1, 0],
  key: name,
  ...over,
});

describe('diffChanges — grass', () => {
  it('emits only the day whose count changed', () => {
    const prev = base({ grass: { d1: 1, d2: 2 } });
    const next = base({ grass: { d1: 1, d2: 3 } });
    const changes = diffChanges(prev, next);
    expect(changes).toEqual([{ kind: 'grass', day: 'd2', count: 3 }]);
  });

  it('emits a newly added day', () => {
    const prev = base({ grass: {} });
    const next = base({ grass: { d1: 1 } });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'grass', day: 'd1', count: 1 },
    ]);
  });

  it('emits nothing when grass unchanged', () => {
    const prev = base({ grass: { d1: 1 } });
    const next = base({ grass: { d1: 1 } });
    expect(diffChanges(prev, next)).toEqual([]);
  });
});

describe('diffChanges — journal', () => {
  it('emits upsert for a new entry', () => {
    const prev = base({ journal: [] });
    const next = base({ journal: [J('j1')] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'journal', op: 'upsert', entry: J('j1') },
    ]);
  });

  it('emits upsert for a modified entry (same id, changed content)', () => {
    const prev = base({ journal: [J('j1', { title: 'old' })] });
    const next = base({ journal: [J('j1', { title: 'new' })] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'journal', op: 'upsert', entry: J('j1', { title: 'new' }) },
    ]);
  });

  it('emits delete for an entry removed by id', () => {
    const prev = base({ journal: [J('j1'), J('j2')] });
    const next = base({ journal: [J('j2')] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'journal', op: 'delete', id: 'j1' },
    ]);
  });

  it('emits nothing when an entry is unchanged', () => {
    const prev = base({ journal: [J('j1')] });
    const next = base({ journal: [J('j1')] });
    expect(diffChanges(prev, next)).toEqual([]);
  });
});

describe('diffChanges — drills', () => {
  it('emits upsert with sortOrder = array index for a new drill', () => {
    const prev = base({ drills: [D('d1')] });
    const next = base({ drills: [D('d1'), D('d2')] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'drill', op: 'upsert', drill: D('d2'), sortOrder: 1 },
    ]);
  });

  it('emits upsert for a modified drill (count change)', () => {
    const prev = base({ drills: [D('d1', { count: 2 })] });
    const next = base({ drills: [D('d1', { count: 3 })] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'drill', op: 'upsert', drill: D('d1', { count: 3 }), sortOrder: 0 },
    ]);
  });

  it('emits delete for a removed drill', () => {
    const prev = base({ drills: [D('d1'), D('d2')] });
    const next = base({ drills: [D('d1')] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'drill', op: 'delete', id: 'd2' },
    ]);
  });

  it('RESET_DRILLS bulk: emits upsert only for drills whose count changed', () => {
    const prev = base({
      drills: [D('d1', { count: 3 }), D('d2', { count: 0 }), D('d3', { count: 5 })],
    });
    const next = base({
      drills: [D('d1', { count: 0 }), D('d2', { count: 0 }), D('d3', { count: 0 })],
    });
    const changes = diffChanges(prev, next);
    // d2 already 0 → unchanged → skipped. d1 & d3 changed → upsert with index sortOrder.
    expect(changes).toEqual([
      { kind: 'drill', op: 'upsert', drill: D('d1', { count: 0 }), sortOrder: 0 },
      { kind: 'drill', op: 'upsert', drill: D('d3', { count: 0 }), sortOrder: 2 },
    ]);
  });
});

describe('diffChanges — collected (name-based, index trap §5)', () => {
  it('emits upsert for a newly collected chord (name key)', () => {
    const prev = base({ collected: [C('C')] });
    const next = base({ collected: [C('C'), C('G')] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'collected', op: 'upsert', chord: C('G') },
    ]);
  });

  it('emits delete by NAME when a chord is removed (not index)', () => {
    // reducer REMOVE_COLLECTED removes by index; diff must derive by name set diff.
    const prev = base({ collected: [C('C'), C('G'), C('Am')] });
    const next = base({ collected: [C('C'), C('Am')] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'collected', op: 'delete', name: 'G' },
    ]);
  });

  it('emits upsert when a chord with same name changes frets', () => {
    const prev = base({ collected: [C('C', { frets: ['x', 3, 2, 0, 1, 0] })] });
    const next = base({ collected: [C('C', { frets: [8, 10, 10, 9, 8, 8] })] });
    expect(diffChanges(prev, next)).toEqual([
      { kind: 'collected', op: 'upsert', chord: C('C', { frets: [8, 10, 10, 9, 8, 8] }) },
    ]);
  });

  it('emits nothing when collected is unchanged', () => {
    const prev = base({ collected: [C('C'), C('G')] });
    const next = base({ collected: [C('C'), C('G')] });
    expect(diffChanges(prev, next)).toEqual([]);
  });
});

describe('diffChanges — lang', () => {
  it('emits lang change when value differs', () => {
    const prev = base({ lang: 'ko' });
    const next = base({ lang: 'en' });
    expect(diffChanges(prev, next)).toEqual([{ kind: 'lang', lang: 'en' }]);
  });

  it('emits nothing when lang unchanged', () => {
    expect(diffChanges(base({ lang: 'ko' }), base({ lang: 'ko' }))).toEqual([]);
  });
});

describe('diffChanges — drill goal reached (grass companion §5)', () => {
  it('emits both drill upsert and grass change together', () => {
    const prev = base({ drills: [D('d1', { count: 4, target: 5 })], grass: {} });
    const next = base({
      drills: [D('d1', { count: 5, target: 5 })],
      grass: { today: 1 },
    });
    const changes = diffChanges(prev, next);
    // Both slices changed → both detected. Order: grass then drill (per implementation).
    expect(changes).toContainEqual({ kind: 'grass', day: 'today', count: 1 });
    expect(changes).toContainEqual({
      kind: 'drill',
      op: 'upsert',
      drill: D('d1', { count: 5, target: 5 }),
      sortOrder: 0,
    });
    expect(changes).toHaveLength(2);
  });
});

describe('diffChanges — empty diff', () => {
  it('emits nothing for identical states', () => {
    const s = base({ grass: { d1: 1 }, journal: [J('j1')], drills: [D('d1')] });
    const changes: RepoChange[] = diffChanges(s, s);
    expect(changes).toEqual([]);
  });
});
