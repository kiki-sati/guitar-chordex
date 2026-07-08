import { describe, it, expect } from 'vitest';
import { reducer, initState } from '../appReducer';
import { emptySequence } from '../../domain/sheet';
import type { AppState } from '../appReducer';
import type { SheetSlot } from '../../domain/types';

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

const C: SheetSlot = { name: 'C', frets: ['x', 3, 2, 0, 1, 0] };
const G: SheetSlot = { name: 'G', frets: [3, 2, 0, 0, 0, 3] };

describe('builder initial state', () => {
  it('sequence starts as emptySequence(4) = 8 nulls, timeSig 4/4, no armed, empty title', () => {
    const s = baseState();
    expect(s.sequence).toEqual(emptySequence(4));
    expect(s.timeSig).toBe('4/4');
    expect(s.armedChord).toBeNull();
    expect(s.sheetTitle).toBe('');
    expect(s.sheets).toEqual([]);
  });

  it('initState accepts persisted sheets (2nd arg)', () => {
    const s = initState(
      { grass: {}, journal: [], collected: [], drills: [], lang: 'ko' },
      [{ id: 'sh1', title: 'x', seq: [C], timeSig: '4/4', date: '2026-07-08' }],
    );
    expect(s.sheets).toHaveLength(1);
  });
});

describe('ARM_CHORD (AC-10)', () => {
  it('arms a chord', () => {
    const s = reducer(baseState(), { type: 'ARM_CHORD', chord: C });
    expect(s.armedChord).toEqual(C);
  });
  it('re-arming the same chord toggles off (null)', () => {
    let s = reducer(baseState(), { type: 'ARM_CHORD', chord: C });
    s = reducer(s, { type: 'ARM_CHORD', chord: C });
    expect(s.armedChord).toBeNull();
  });
  it('arming a different chord replaces', () => {
    let s = reducer(baseState(), { type: 'ARM_CHORD', chord: C });
    s = reducer(s, { type: 'ARM_CHORD', chord: G });
    expect(s.armedChord).toEqual(G);
  });
});

describe('PLACE_AT (AC-11/12/13)', () => {
  it('armed + empty slot → places armed chord (AC-11)', () => {
    let s = baseState({ armedChord: C });
    s = reducer(s, { type: 'PLACE_AT', index: 2 });
    expect(s.sequence[2]).toEqual(C);
  });
  it('no armed + filled slot → clears it (AC-12)', () => {
    let s = baseState({ sequence: [C, G, null, null], armedChord: null });
    s = reducer(s, { type: 'PLACE_AT', index: 0 });
    expect(s.sequence[0]).toBeNull();
    expect(s.sequence[1]).toEqual(G);
  });
  it('no armed + empty slot → sequence unchanged + toast (AC-13)', () => {
    const before = baseState({ armedChord: null });
    const s = reducer(before, { type: 'PLACE_AT', index: 0 });
    expect(s.sequence).toEqual(before.sequence);
    expect(s.toast).not.toBe('');
  });
  it('armed + filled slot → replaces with armed (AC-11 variant)', () => {
    let s = baseState({ sequence: [C, null, null, null], armedChord: G });
    s = reducer(s, { type: 'PLACE_AT', index: 0 });
    expect(s.sequence[0]).toEqual(G);
  });
});

describe('CLEAR_SLOT', () => {
  it('clears a specific index', () => {
    let s = baseState({ sequence: [C, G, null, null] });
    s = reducer(s, { type: 'CLEAR_SLOT', index: 1 });
    expect(s.sequence[1]).toBeNull();
  });
});

describe('ADD_MEASURE', () => {
  it('appends beats nulls (4/4 → +4)', () => {
    let s = baseState({ sequence: [C, G, null, null], timeSig: '4/4' });
    s = reducer(s, { type: 'ADD_MEASURE' });
    expect(s.sequence).toHaveLength(8);
  });
});

describe('REMOVE_MEASURE', () => {
  it('removes a measure and re-pads', () => {
    let s = baseState({
      sequence: [C, G, null, null, null, null, null, null],
      timeSig: '4/4',
    });
    s = reducer(s, { type: 'REMOVE_MEASURE', measureIndex: 1 });
    expect(s.sequence).toHaveLength(4);
    expect(s.sequence[0]).toEqual(C);
  });
});

describe('SET_TIME_SIG (AC-7)', () => {
  it('switches 4/4→3/4 and re-pads to a multiple of 3, keeping chords', () => {
    let s = baseState({
      sequence: [C, G, null, null, null, null, null, null],
      timeSig: '4/4',
    });
    s = reducer(s, { type: 'SET_TIME_SIG', timeSig: '3/4' });
    expect(s.timeSig).toBe('3/4');
    expect(s.sequence.length % 3).toBe(0);
    expect(s.sequence[0]).toEqual(C);
    expect(s.sequence[1]).toEqual(G);
  });
});

describe('SET_SHEET_TITLE', () => {
  it('sets the sheet title', () => {
    const s = reducer(baseState(), { type: 'SET_SHEET_TITLE', title: '내 진행' });
    expect(s.sheetTitle).toBe('내 진행');
  });
});

describe('CLEAR_SEQUENCE (AC-14)', () => {
  it('resets sequence to beats*2 empty slots', () => {
    let s = baseState({ sequence: [C, G, C, G], timeSig: '4/4' });
    s = reducer(s, { type: 'CLEAR_SEQUENCE' });
    expect(s.sequence).toEqual(emptySequence(4));
  });
  it('3/4 resets to 6 nulls', () => {
    let s = baseState({ sequence: [C, G, C], timeSig: '3/4' });
    s = reducer(s, { type: 'CLEAR_SEQUENCE' });
    expect(s.sequence).toEqual(emptySequence(3));
  });
});

describe('SAVE_SHEET (AC-15)', () => {
  it('rejects save when no filled slots (toast + sheets unchanged)', () => {
    const s = reducer(baseState(), { type: 'SAVE_SHEET' });
    expect(s.sheets).toHaveLength(0);
    expect(s.toast).not.toBe('');
  });
  it('prepends a new sheet when >=1 filled slot + success toast', () => {
    let s = baseState({ sequence: [C, null, G, null], sheetTitle: '내 악보' });
    s = reducer(s, { type: 'SAVE_SHEET' });
    expect(s.sheets).toHaveLength(1);
    expect(s.sheets[0].title).toBe('내 악보');
    expect(s.sheets[0].timeSig).toBe('4/4');
    expect(s.sheets[0].seq).toEqual([C, null, G, null]);
    expect(s.sheets[0].id.startsWith('sh')).toBe(true);
    expect(s.sheets[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.toast).not.toBe('');
  });
  it('uses a fallback title when sheetTitle is empty', () => {
    let s = baseState({ sequence: [C, null, null, null], sheetTitle: '' });
    s = reducer(s, { type: 'SAVE_SHEET' });
    expect(s.sheets[0].title.length).toBeGreaterThan(0);
  });
  it('prepends (newest first)', () => {
    let s = baseState({ sequence: [C, null, null, null], sheetTitle: 'A' });
    s = reducer(s, { type: 'SAVE_SHEET' });
    s = { ...s, sequence: [G, null, null, null], sheetTitle: 'B' };
    s = reducer(s, { type: 'SAVE_SHEET' });
    expect(s.sheets.map((x) => x.title)).toEqual(['B', 'A']);
  });
});

describe('LOAD_SHEET (AC-16)', () => {
  it('restores title/timeSig/sequence (padded)', () => {
    let s = baseState({
      sheets: [
        {
          id: 'sh1',
          title: '캐논',
          seq: [C, G, null],
          timeSig: '3/4',
          date: '2026-07-08',
        },
      ],
    });
    s = reducer(s, { type: 'LOAD_SHEET', id: 'sh1' });
    expect(s.sheetTitle).toBe('캐논');
    expect(s.timeSig).toBe('3/4');
    expect(s.sequence.length % 3).toBe(0);
    expect(s.sequence[0]).toEqual(C);
    expect(s.sequence[1]).toEqual(G);
    expect(s.toast).not.toBe('');
  });
  it('unknown id is a no-op', () => {
    const before = baseState({ sheets: [] });
    const s = reducer(before, { type: 'LOAD_SHEET', id: 'nope' });
    expect(s.sequence).toEqual(before.sequence);
  });
});

describe('DELETE_SHEET (AC-17)', () => {
  it('removes the sheet with the given id', () => {
    let s = baseState({
      sheets: [
        { id: 'sh1', title: 'A', seq: [C], timeSig: '4/4', date: '2026-07-08' },
        { id: 'sh2', title: 'B', seq: [G], timeSig: '4/4', date: '2026-07-08' },
      ],
    });
    s = reducer(s, { type: 'DELETE_SHEET', id: 'sh1' });
    expect(s.sheets.map((x) => x.id)).toEqual(['sh2']);
  });
});

describe('HYDRATE preserves transient sheets state (동기화 무간섭)', () => {
  it('HYDRATE does not clobber sheets/sequence/armed/timeSig/title', () => {
    const s0 = baseState({
      sheets: [{ id: 'sh1', title: 'A', seq: [C], timeSig: '4/4', date: '2026-07-08' }],
      sequence: [C, G, null, null],
      armedChord: G,
      timeSig: '4/4',
      sheetTitle: '작업중',
    });
    const s = reducer(s0, {
      type: 'HYDRATE',
      persisted: { grass: {}, journal: [], collected: [], drills: [], lang: 'en' },
    });
    // 서버 pull은 4슬라이스+lang만 교체, sheets/작업중 트랜션트는 spread로 보존
    expect(s.sheets).toEqual(s0.sheets);
    expect(s.sequence).toEqual(s0.sequence);
    expect(s.armedChord).toEqual(G);
    expect(s.sheetTitle).toBe('작업중');
    expect(s.lang).toBe('en');
  });
});
