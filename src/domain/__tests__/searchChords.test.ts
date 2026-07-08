import { describe, it, expect } from 'vitest';
import { searchChords } from '../searchChords';
import { QUALS, SUF } from '../constants';
import { noteName, normalizeQuery } from '../notes';
import type { Quality, RootIndex } from '../types';

/** NOTE index: C0 C#1 D2 D#3 E4 F5 F#6 G7 G#8 A9 A#10 B11 */

function hasHit(query: string, root: RootIndex, qual: Quality): boolean {
  return searchChords(query).some((h) => h.root === root && h.qualKey === qual);
}

describe('searchChords — existing behavior preserved (regression)', () => {
  it('empty / whitespace query → no hits', () => {
    expect(searchChords('')).toEqual([]);
    expect(searchChords('   ')).toEqual([]);
  });
  it('plain "C" hits many C-rooted chords (partial match)', () => {
    const hits = searchChords('C');
    expect(hits.some((h) => h.root === 0 && h.qualKey === 'maj')).toBe(true);
    expect(hits.some((h) => h.root === 0 && h.qualKey === 'm7')).toBe(true);
  });
  it('"Cmaj7" hits C maj7', () => {
    expect(hasHit('Cmaj7', 0, 'maj7')).toBe(true);
  });
  it('flat/sharp unicode folds to ascii (Bb == a#)', () => {
    // Bb root is A#10 in canonical NOTE; searching "Bbm7" must hit A#(10) m7
    expect(hasHit('Bbm7', 10, 'm7')).toBe(true);
  });
});

describe('searchChords — inventory non-slash golden hits (§1.1 spot-check)', () => {
  const cases: Array<[string, RootIndex, Quality]> = [
    ['AM7', 9, 'maj7'],
    ['CM7', 0, 'maj7'],
    ['GM7', 7, 'maj7'],
    ['Aadd2', 9, 'add9'],
    ['Cadd2', 0, 'add9'],
    ['Dbadd2', 1, 'add9'],
    ['Gadd2', 7, 'add9'],
    ['Am6', 9, 'm6'],
    ['D7(9)', 2, '9'],
    ['Eb7(9)', 3, '9'],
    ['C#7(b9)', 1, '7b9'],
    ['F#m7(11)', 6, 'm11'],
    ['E7sus4', 4, '7sus4'],
    ['Bbm7', 10, 'm7'],
    ['G#m7', 8, 'm7'],
  ];
  for (const [query, root, qual] of cases) {
    it(`"${query}" hits root ${root} / ${qual}`, () => {
      expect(hasHit(query, root, qual)).toBe(true);
    });
  }
});

describe('searchChords — case-trap: lenient search finds both, but AM7 must surface maj7', () => {
  it('AM7 (uppercase M) surfaces A maj7', () => {
    expect(hasHit('AM7', 9, 'maj7')).toBe(true);
  });
  it('Am7 (lowercase m) surfaces A m7', () => {
    expect(hasHit('Am7', 9, 'm7')).toBe(true);
  });
});

describe('searchChords — Δ and enharmonic equivalence', () => {
  it('CΔ hits C maj7', () => {
    expect(hasHit('CΔ', 0, 'maj7')).toBe(true);
  });
  it('C#7(♭9) unicode flat hits C# 7b9', () => {
    expect(hasHit('C#7(♭9)', 1, '7b9')).toBe(true);
  });
});

describe('searchChords — superset of legacy inline algorithm (no regression)', () => {
  // Legacy DictionaryView algorithm (origin/main): normalize(noteName(r)+SUF[ql]).includes(normalizeQuery(query))
  function legacyHits(query: string): Set<string> {
    const q = normalizeQuery(query);
    const out = new Set<string>();
    for (let r = 0; r < 12; r++) {
      for (const ql of QUALS as readonly Quality[]) {
        const nm = normalizeQuery(noteName(r) + (SUF[ql] || ''));
        if (nm.includes(q)) out.add(r + '|' + ql);
      }
    }
    return out;
  }

  for (const query of ['C', 'm7', 'maj7', 'A', 'sus4', '9', 'dim', 'G#', 'add9']) {
    it(`"${query}" — every legacy hit is still present`, () => {
      const legacy = legacyHits(query);
      const now = new Set(searchChords(query).map((h) => h.root + '|' + h.qualKey));
      for (const key of legacy) {
        expect(now.has(key)).toBe(true);
      }
    });
  }
});

describe('searchChords — slash query deferred to PR-B', () => {
  it('slash query returns no hits (no crash) in PR-A', () => {
    expect(searchChords('G/B')).toEqual([]);
    expect(searchChords('Gadd2/B')).toEqual([]);
  });
});
