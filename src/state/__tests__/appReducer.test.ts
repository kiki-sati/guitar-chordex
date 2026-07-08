import { describe, it, expect } from 'vitest';
import { reducer, initState } from '../appReducer';
import { dateStr } from '../../domain/notes';
import type { AppState } from '../appReducer';
import type { Chord } from '../../domain/types';

function baseState(overrides: Partial<AppState> = {}): AppState {
  const s = initState({
    grass: {},
    journal: [],
    collected: [],
    drills: [],
    lang: 'ko',
  });
  return { ...s, ...overrides };
}

const today = dateStr(new Date());

describe('navigation & selection', () => {
  it('SET_VIEW changes view', () => {
    const s = reducer(baseState(), { type: 'SET_VIEW', view: 'scales' });
    expect(s.view).toBe('scales');
  });
  it('SET_ROOT changes selectedRoot', () => {
    const s = reducer(baseState(), { type: 'SET_ROOT', root: 7 });
    expect(s.selectedRoot).toBe(7);
  });
  it('SET_QUERY sets the search query', () => {
    const s = reducer(baseState(), { type: 'SET_QUERY', query: 'am7' });
    expect(s.query).toBe('am7');
  });
});

describe('LOG_PRACTICE', () => {
  it('increments today grass and shows toast', () => {
    const s = reducer(baseState(), { type: 'LOG_PRACTICE' });
    expect(s.grass[today]).toBe(1);
    expect(s.toast).not.toBe('');
  });
  it('accumulates on repeated calls', () => {
    let s = reducer(baseState(), { type: 'LOG_PRACTICE' });
    s = reducer(s, { type: 'LOG_PRACTICE' });
    expect(s.grass[today]).toBe(2);
  });
});

describe('COLLECT', () => {
  it('adds a collected chord', () => {
    const s = reducer(baseState(), {
      type: 'COLLECT',
      chord: { name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' },
    });
    expect(s.collected).toHaveLength(1);
    expect(s.collected[0].name).toBe('C');
  });
  it('rejects duplicates with a toast (no double add)', () => {
    let s = reducer(baseState(), {
      type: 'COLLECT',
      chord: { name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' },
    });
    s = reducer(s, {
      type: 'COLLECT',
      chord: { name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' },
    });
    expect(s.collected).toHaveLength(1);
    expect(s.toast).toContain('이미');
  });
});

describe('ADD_JOURNAL', () => {
  it('prepends entry, grows grass, resets draft', () => {
    let s = baseState();
    s = reducer(s, {
      type: 'SET_JOURNAL_DRAFT',
      patch: { jTitle: '스케일 연습', jMin: '40', jChords: 'C G Am', jNotes: '메모' },
    });
    s = reducer(s, { type: 'ADD_JOURNAL' });
    expect(s.journal).toHaveLength(1);
    expect(s.journal[0].title).toBe('스케일 연습');
    expect(s.journal[0].minutes).toBe(40);
    expect(s.journal[0].chords).toEqual(['C', 'G', 'Am']);
    expect(s.grass[today]).toBe(1);
    // draft reset
    expect(s.jTitle).toBe('');
    expect(s.jChords).toBe('');
  });
  it('rejects empty title with a toast', () => {
    let s = baseState();
    s = reducer(s, { type: 'SET_JOURNAL_DRAFT', patch: { jTitle: '   ' } });
    s = reducer(s, { type: 'ADD_JOURNAL' });
    expect(s.journal).toHaveLength(0);
    expect(s.toast).not.toBe('');
  });
});

describe('drills', () => {
  const drillState = () =>
    baseState({ drills: [{ id: 'd1', title: '드릴', target: 3, count: 0 }] });

  it('SET_DRILL_COUNT sets count', () => {
    const s = reducer(drillState(), { type: 'SET_DRILL_COUNT', id: 'd1', n: 2 });
    expect(s.drills[0].count).toBe(2);
  });

  it('grass +1 only on the transition into goal (before<target && after>=target)', () => {
    let s = drillState();
    s = reducer(s, { type: 'SET_DRILL_COUNT', id: 'd1', n: 2 });
    expect(s.grass[today]).toBeUndefined(); // not reached yet
    s = reducer(s, { type: 'SET_DRILL_COUNT', id: 'd1', n: 3 }); // reach goal
    expect(s.grass[today]).toBe(1);
    expect(s.toast).toContain('목표 달성');
  });

  it('does not double-count grass when already at goal', () => {
    let s = drillState();
    s = reducer(s, { type: 'SET_DRILL_COUNT', id: 'd1', n: 3 }); // reach -> +1
    const after = s.grass[today];
    s = reducer(s, { type: 'SET_DRILL_COUNT', id: 'd1', n: 3 }); // still at goal
    expect(s.grass[today]).toBe(after);
  });

  it('BUMP_DRILL_TARGET clamps to [1,40]', () => {
    let s = drillState();
    s = reducer(s, { type: 'BUMP_DRILL_TARGET', id: 'd1', delta: -5 });
    expect(s.drills[0].target).toBe(1);
    s = reducer(s, { type: 'BUMP_DRILL_TARGET', id: 'd1', delta: 100 });
    expect(s.drills[0].target).toBe(40);
  });

  it('ADD_DRILL adds from draft and resets', () => {
    let s = baseState();
    s = reducer(s, { type: 'SET_DRILL_DRAFT', patch: { dTitle: '새 드릴', dTarget: 7 } });
    s = reducer(s, { type: 'ADD_DRILL' });
    expect(s.drills).toHaveLength(1);
    expect(s.drills[0].title).toBe('새 드릴');
    expect(s.drills[0].target).toBe(7);
    expect(s.dTitle).toBe('');
  });

  it('REMOVE_DRILL removes by id', () => {
    const s = reducer(drillState(), { type: 'REMOVE_DRILL', id: 'd1' });
    expect(s.drills).toHaveLength(0);
  });

  it('RESET_DRILLS zeroes counts', () => {
    let s = baseState({ drills: [{ id: 'd1', title: 'x', target: 5, count: 4 }] });
    s = reducer(s, { type: 'RESET_DRILLS' });
    expect(s.drills[0].count).toBe(0);
  });
});

describe('detail screen & toast', () => {
  const cChord: Chord = {
    name: 'C',
    frets: ['x', 3, 2, 0, 1, 0],
    root: 0,
    qualKey: 'maj',
    key: 'C',
  };

  it('OPEN_DETAIL sets detailChord, switches to chordDetail view, records return view', () => {
    const s = reducer(baseState({ view: 'dictionary' }), {
      type: 'OPEN_DETAIL',
      chord: cChord,
    });
    expect(s.detailChord).toEqual({ root: 0, qualKey: 'maj', name: 'C' });
    expect(s.view).toBe('chordDetail');
    expect(s.detailReturnView).toBe('dictionary');
  });

  it('OPEN_DETAIL from home records home as return view', () => {
    const s = reducer(baseState({ view: 'home' }), {
      type: 'OPEN_DETAIL',
      chord: cChord,
    });
    expect(s.detailReturnView).toBe('home');
  });

  it('OPEN_DETAIL while already on chordDetail keeps the original return view (re-entry guard)', () => {
    let s = reducer(baseState({ view: 'dictionary' }), {
      type: 'OPEN_DETAIL',
      chord: cChord,
    });
    // second open (e.g. from within the detail screen) must not overwrite return view
    s = reducer(s, {
      type: 'OPEN_DETAIL',
      chord: { ...cChord, name: 'Cmaj7', qualKey: 'maj7' },
    });
    expect(s.detailReturnView).toBe('dictionary');
    expect(s.detailChord).toEqual({ root: 0, qualKey: 'maj7', name: 'Cmaj7' });
  });

  it('CLOSE_DETAIL clears detail and returns to the recorded view', () => {
    let s = reducer(baseState({ view: 'dictionary' }), {
      type: 'OPEN_DETAIL',
      chord: cChord,
    });
    s = reducer(s, { type: 'CLOSE_DETAIL' });
    expect(s.detailChord).toBeNull();
    expect(s.view).toBe('dictionary');
  });

  it('CLOSE_DETAIL is idempotent when not on the detail screen', () => {
    const s = reducer(baseState({ view: 'practice' }), {
      type: 'CLOSE_DETAIL',
    });
    expect(s.view).toBe('practice');
    expect(s.detailChord).toBeNull();
  });

  it('initState defaults detailReturnView to dictionary', () => {
    expect(baseState().detailReturnView).toBe('dictionary');
  });

  it('CLEAR_TOAST clears the toast', () => {
    let s = reducer(baseState(), { type: 'SHOW_TOAST', msg: 'hi' });
    expect(s.toast).toBe('hi');
    s = reducer(s, { type: 'CLEAR_TOAST' });
    expect(s.toast).toBe('');
  });
});
