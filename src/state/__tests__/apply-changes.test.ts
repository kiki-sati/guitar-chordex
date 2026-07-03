import { describe, it, expect } from 'vitest';
import { applyChanges } from '../apply-changes';
import type { PersistedState } from '../persist';

function base(over: Partial<PersistedState> = {}): PersistedState {
  return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko', ...over };
}

describe('applyChanges', () => {
  it('grass: sets absolute count (idempotent)', () => {
    const s1 = applyChanges(base(), [{ kind: 'grass', day: 'd1', count: 2 }]);
    expect(s1.grass).toEqual({ d1: 2 });
    const s2 = applyChanges(s1, [{ kind: 'grass', day: 'd1', count: 2 }]);
    expect(s2.grass).toEqual({ d1: 2 });
  });

  it('journal upsert adds then updates by id; delete removes', () => {
    const e = { id: 'j1', date: 'd', title: 't', minutes: 1, chords: [], notes: '' };
    let s = applyChanges(base(), [{ kind: 'journal', op: 'upsert', entry: e }]);
    expect(s.journal).toHaveLength(1);
    s = applyChanges(s, [{ kind: 'journal', op: 'upsert', entry: { ...e, title: 'x' } }]);
    expect(s.journal[0].title).toBe('x');
    s = applyChanges(s, [{ kind: 'journal', op: 'delete', id: 'j1' }]);
    expect(s.journal).toEqual([]);
  });

  it('collected upsert/delete by name', () => {
    const c = { name: 'C', frets: ['x', 3, 2, 0, 1, 0] as (number | 'x')[], key: 'C' };
    let s = applyChanges(base(), [{ kind: 'collected', op: 'upsert', chord: c }]);
    expect(s.collected).toHaveLength(1);
    s = applyChanges(s, [{ kind: 'collected', op: 'delete', name: 'C' }]);
    expect(s.collected).toEqual([]);
  });

  it('drill upsert/delete by id; lang set', () => {
    const d = { id: 'd1', title: 't', target: 5, count: 0 };
    let s = applyChanges(base(), [{ kind: 'drill', op: 'upsert', drill: d, sortOrder: 0 }]);
    expect(s.drills).toHaveLength(1);
    s = applyChanges(s, [{ kind: 'lang', lang: 'en' }]);
    expect(s.lang).toBe('en');
    s = applyChanges(s, [{ kind: 'drill', op: 'delete', id: 'd1' }]);
    expect(s.drills).toEqual([]);
  });

  it('does not mutate the input state', () => {
    const input = base({ grass: { d1: 1 } });
    applyChanges(input, [{ kind: 'grass', day: 'd2', count: 2 }]);
    expect(input.grass).toEqual({ d1: 1 });
  });
});
