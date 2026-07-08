import { describe, it, expect } from 'vitest';
import {
  beatsOf,
  padSlots,
  placeAt,
  clearSlot,
  addMeasure,
  removeMeasure,
  retime,
  sequenceToMeasures,
  usedChords,
  filledCount,
  emptySequence,
  makeSheet,
} from '../sheet';
import { BEATS } from '../constants';
import type { SheetSequence, SheetSlot } from '../types';

// 골든 코드 슬롯 (원본 buildChord 결과 shape {name,frets})
const C: SheetSlot = { name: 'C', frets: ['x', 3, 2, 0, 1, 0] };
const G: SheetSlot = { name: 'G', frets: [3, 2, 0, 0, 0, 3] };
const Am: SheetSlot = { name: 'Am', frets: ['x', 0, 2, 2, 1, 0] };

describe('beatsOf (원본 라인 457)', () => {
  it('maps 4/4→4, 3/4→3, 6/8→6', () => {
    expect(beatsOf('4/4')).toBe(4);
    expect(beatsOf('3/4')).toBe(3);
    expect(beatsOf('6/8')).toBe(6);
  });
  it('BEATS constant matches beatsOf', () => {
    expect(BEATS['4/4']).toBe(4);
    expect(BEATS['3/4']).toBe(3);
    expect(BEATS['6/8']).toBe(6);
  });
});

describe('padSlots (원본 라인 458)', () => {
  it('empty array → length beats*2 nulls', () => {
    expect(padSlots([], 4)).toEqual(new Array(8).fill(null));
    expect(padSlots([], 3)).toEqual(new Array(6).fill(null));
  });
  it('pads to next multiple of beats, preserving existing elements', () => {
    const seq: SheetSequence = [C, null, G];
    const out = padSlots(seq, 4);
    expect(out).toHaveLength(4);
    expect(out.slice(0, 3)).toEqual([C, null, G]);
    expect(out[3]).toBeNull();
  });
  it('already a multiple of beats → unchanged length', () => {
    const seq: SheetSequence = [C, G, Am, null];
    expect(padSlots(seq, 4)).toHaveLength(4);
  });
  it('does not mutate input', () => {
    const seq: SheetSequence = [C];
    const copy = seq.slice();
    padSlots(seq, 4);
    expect(seq).toEqual(copy);
  });
});

describe('placeAt (원본 라인 460)', () => {
  it('places a chord at index i (absolute index kept)', () => {
    const seq = emptySequence(4);
    const out = placeAt(seq, 2, C);
    expect(out[2]).toEqual(C);
    expect(out[0]).toBeNull();
  });
  it('null chord clears the slot', () => {
    const seq: SheetSequence = [C, G, Am, null];
    const out = placeAt(seq, 1, null);
    expect(out[1]).toBeNull();
    expect(out[0]).toEqual(C);
  });
  it('does not mutate input', () => {
    const seq: SheetSequence = [null, null];
    const copy = seq.slice();
    placeAt(seq, 0, C);
    expect(seq).toEqual(copy);
  });
});

describe('clearSlot (원본 라인 461)', () => {
  it('sets index i to null', () => {
    const seq: SheetSequence = [C, G, Am, null];
    const out = clearSlot(seq, 0);
    expect(out[0]).toBeNull();
    expect(out[1]).toEqual(G);
  });
});

describe('addMeasure (원본 라인 462)', () => {
  it('appends beats nulls', () => {
    const seq: SheetSequence = [C, G, Am, null];
    const out = addMeasure(seq, 4);
    expect(out).toHaveLength(8);
    expect(out.slice(4)).toEqual([null, null, null, null]);
    expect(out.slice(0, 4)).toEqual([C, G, Am, null]);
  });
  it('appends beats nulls for 3/4', () => {
    expect(addMeasure([], 3)).toHaveLength(3);
  });
});

describe('removeMeasure (원본 라인 463)', () => {
  it('splices out the measure then re-pads', () => {
    // 2 measures of 4/4: [C,G,Am,null | null,null,null,null]
    const seq: SheetSequence = [C, G, Am, null, null, null, null, null];
    const out = removeMeasure(seq, 0, 4);
    // first measure removed → remaining is measure 2 (4 nulls), padSlots keeps multiple of 4
    expect(out).toHaveLength(4);
    expect(out.every((x) => x === null)).toBe(true);
  });
  it('removing leaves at least beats*2 when emptied to zero', () => {
    // single measure removed → empty → padSlots fills beats*2
    const seq: SheetSequence = [C, G, Am, null];
    const out = removeMeasure(seq, 0, 4);
    expect(out).toHaveLength(8); // padSlots([],4) → beats*2
  });
});

describe('retime (setTimeSig 순수부, 원본 라인 464)', () => {
  it('re-pads sequence to a multiple of new beats, keeping placed chords', () => {
    // 4/4 8칸 with chords → to 3/4 (beats 3)
    const seq: SheetSequence = [C, G, Am, null, null, null, null, null];
    const out = retime(seq, 3);
    expect(out.length % 3).toBe(0);
    expect(out[0]).toEqual(C);
    expect(out[1]).toEqual(G);
    expect(out[2]).toEqual(Am);
  });
});

describe('sequenceToMeasures (렌더용 분할, 원본 builderView 라인 607-608)', () => {
  it('splits into measures of length beats', () => {
    const seq: SheetSequence = [C, G, Am, null, null, null, null, null];
    const measures = sequenceToMeasures(seq, 4);
    expect(measures).toHaveLength(2);
    expect(measures[0]).toEqual([C, G, Am, null]);
    expect(measures[1]).toEqual([null, null, null, null]);
  });
  it('empty sequence yields at least one empty measure', () => {
    const measures = sequenceToMeasures([], 4);
    expect(measures).toHaveLength(1);
    expect(measures[0]).toEqual([null, null, null, null]);
  });
  it('3/4 splits into groups of 3', () => {
    const seq: SheetSequence = [C, G, Am, null, null, null];
    const measures = sequenceToMeasures(seq, 3);
    expect(measures).toHaveLength(2);
    expect(measures[0]).toHaveLength(3);
  });
});

describe('usedChords (chordBox 고유 코드, 원본 라인 624)', () => {
  it('returns unique chords by name in first-seen order', () => {
    const seq: SheetSequence = [C, G, C, Am, null, G];
    const used = usedChords(seq);
    expect(used.map((c) => c.name)).toEqual(['C', 'G', 'Am']);
  });
  it('empty for all-null sequence', () => {
    expect(usedChords([null, null])).toEqual([]);
  });
});

describe('filledCount', () => {
  it('counts non-null slots', () => {
    expect(filledCount([C, null, G, null])).toBe(2);
    expect(filledCount([null, null])).toBe(0);
  });
});

describe('emptySequence', () => {
  it('returns beats*2 nulls', () => {
    expect(emptySequence(4)).toEqual(new Array(8).fill(null));
    expect(emptySequence(3)).toEqual(new Array(6).fill(null));
  });
});

describe('makeSheet (원본 saveSheet 형태, 라인 468)', () => {
  it('builds a Sheet with id prefix sh, title, seq copy, timeSig, date', () => {
    const seq: SheetSequence = [C, G, null, null];
    const sheet = makeSheet('My Sheet', seq, '4/4', '2026-07-08');
    expect(sheet.id.startsWith('sh')).toBe(true);
    expect(sheet.title).toBe('My Sheet');
    expect(sheet.timeSig).toBe('4/4');
    expect(sheet.date).toBe('2026-07-08');
    expect(sheet.seq).toEqual([C, G, null, null]);
    // seq is a copy (not the same reference)
    expect(sheet.seq).not.toBe(seq);
  });
});
