import { describe, it, expect } from 'vitest';
import { reducer, initState } from '../appReducer';
import type { AppState } from '../appReducer';
import type { PersistedState } from '../persist';

function stateWith(over: Partial<AppState> = {}): AppState {
  const s = initState({ grass: {}, journal: [], collected: [], drills: [], lang: 'ko' });
  return { ...s, ...over };
}

const HYDRATED: PersistedState = {
  grass: { '2026-07-01': 3 },
  journal: [{ id: 'j1', date: '2026-07-01', title: 't', minutes: 5, chords: ['C'], notes: 'n' }],
  drills: [{ id: 'd1', title: 'x', target: 5, count: 2 }],
  collected: [{ name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' }],
  lang: 'en',
};

describe('HYDRATE (PR⑤ §4.2)', () => {
  it('replaces the 4 persisted slices + lang', () => {
    const s = reducer(stateWith(), { type: 'HYDRATE', persisted: HYDRATED });
    expect(s.grass).toEqual(HYDRATED.grass);
    expect(s.journal).toEqual(HYDRATED.journal);
    expect(s.drills).toEqual(HYDRATED.drills);
    expect(s.collected).toEqual(HYDRATED.collected);
    expect(s.lang).toBe('en');
  });

  it('preserves transient state (view/drafts/toast/detail)', () => {
    const before = stateWith({
      view: 'practice',
      query: 'am7',
      jTitle: 'draft-title',
      jChords: 'C G',
      dTitle: 'drill-draft',
      dTarget: 12,
      toast: 'hello',
      selectedRoot: 7,
      homeLayout: 'board',
      detailChord: { root: 0, qualKey: 'maj', name: 'C' },
      detailReturnView: 'scales',
    });
    const s = reducer(before, { type: 'HYDRATE', persisted: HYDRATED });
    expect(s.view).toBe('practice');
    expect(s.query).toBe('am7');
    expect(s.jTitle).toBe('draft-title');
    expect(s.jChords).toBe('C G');
    expect(s.dTitle).toBe('drill-draft');
    expect(s.dTarget).toBe(12);
    expect(s.toast).toBe('hello');
    expect(s.selectedRoot).toBe(7);
    expect(s.homeLayout).toBe('board');
    expect(s.detailChord).toEqual({ root: 0, qualKey: 'maj', name: 'C' });
    expect(s.detailReturnView).toBe('scales');
  });

  it('is pure/deterministic — same input yields equal output', () => {
    const a = reducer(stateWith(), { type: 'HYDRATE', persisted: HYDRATED });
    const b = reducer(stateWith(), { type: 'HYDRATE', persisted: HYDRATED });
    expect(a).toEqual(b);
  });
});
