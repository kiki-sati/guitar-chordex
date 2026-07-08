import { describe, it, expect } from 'vitest';
import { parseChordName } from '../parseChordName';
import type { Quality, RootIndex } from '../types';

/** NOTE index reference: C0 C#1 D2 D#3 E4 F5 F#6 G7 G#8 A9 A#10 B11 */

describe('parseChordName — root extraction (§2.3 step 3)', () => {
  const roots: Array<[string, RootIndex]> = [
    ['C', 0], ['D', 2], ['E', 4], ['F', 5], ['G', 7], ['A', 9], ['B', 11],
    ['C#', 1], ['Db', 1], ['D#', 3], ['Eb', 3], ['F#', 6], ['Gb', 6],
    ['G#', 8], ['Ab', 8], ['A#', 10], ['Bb', 10],
  ];
  for (const [name, idx] of roots) {
    it(`"${name}" root → ${idx} (major triad, empty suffix)`, () => {
      const p = parseChordName(name);
      expect(p).not.toBeNull();
      expect(p!.root).toBe(idx);
      expect(p!.qualKey).toBe('maj');
    });
  }

  it('accepts lowercase root letter (g/b style, §2.3 allows lowercase root)', () => {
    const p = parseChordName('a');
    expect(p).not.toBeNull();
    expect(p!.root).toBe(9);
    expect(p!.qualKey).toBe('maj');
  });

  it('accepts unicode ♯/♭ in root', () => {
    expect(parseChordName('C♯')!.root).toBe(1);
    expect(parseChordName('D♭')!.root).toBe(1);
  });
});

describe('parseChordName — case-sensitive maj7 vs minor (§2.3 core table)', () => {
  it('AM7 → A maj7 (uppercase M)', () => {
    const p = parseChordName('AM7');
    expect(p).toEqual({ root: 9, qualKey: 'maj7', display: 'AM7' });
  });
  it('Am7 → A m7 (lowercase m)', () => {
    const p = parseChordName('Am7');
    expect(p).toEqual({ root: 9, qualKey: 'm7', display: 'Am7' });
  });
  it('am7 (lowercase root + lowercase m) → A m7', () => {
    const p = parseChordName('am7');
    expect(p!.root).toBe(9);
    expect(p!.qualKey).toBe('m7');
  });
  it('AMaj7 (uppercase M + aj) → A maj7', () => {
    expect(parseChordName('AMaj7')!.qualKey).toBe('maj7');
  });
  it('Amaj7 (lowercase maj) → A maj7', () => {
    expect(parseChordName('Amaj7')!.qualKey).toBe('maj7');
  });
  it('single uppercase AM → A major triad (coordinator decision: M alone = major)', () => {
    const p = parseChordName('AM');
    expect(p!.root).toBe(9);
    expect(p!.qualKey).toBe('maj');
  });
  it('Am (lowercase m alone) → A minor triad', () => {
    const p = parseChordName('Am');
    expect(p!.root).toBe(9);
    expect(p!.qualKey).toBe('min');
  });
  it('Cmaj / Cmajor → C major triad', () => {
    expect(parseChordName('Cmaj')!.qualKey).toBe('maj');
    expect(parseChordName('Cmajor')!.qualKey).toBe('maj');
  });
  it('Cmin / Cminor → C minor triad', () => {
    expect(parseChordName('Cmin')!.qualKey).toBe('min');
    expect(parseChordName('Cminor')!.qualKey).toBe('min');
  });
});

describe('parseChordName — inventory non-slash golden (§1.1)', () => {
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
  for (const [name, root, qual] of cases) {
    it(`"${name}" → root ${root}, ${qual}`, () => {
      const p = parseChordName(name);
      expect(p).not.toBeNull();
      expect(p!.root).toBe(root);
      expect(p!.qualKey).toBe(qual);
      expect(p!.display).toBe(name);
    });
  }
});

describe('parseChordName — unicode/equivalence tension forms', () => {
  it('CΔ → C maj7 (Δ alias)', () => {
    expect(parseChordName('CΔ')!.qualKey).toBe('maj7');
  });
  it('C#7(♭9) unicode flat equals C#7(b9)', () => {
    expect(parseChordName('C#7(♭9)')).toEqual({ root: 1, qualKey: '7b9', display: 'C#7(♭9)' });
  });
});

describe('parseChordName — failure cases', () => {
  it('empty string → null', () => {
    expect(parseChordName('')).toBeNull();
    expect(parseChordName('   ')).toBeNull();
  });
  it('slash input → null in PR-A (bass handled in PR-B)', () => {
    expect(parseChordName('G/B')).toBeNull();
    expect(parseChordName('Gadd2/B')).toBeNull();
  });
  it('unknown quality → null', () => {
    expect(parseChordName('Cwizzle99')).toBeNull();
  });
  it('non-note leading char → null', () => {
    expect(parseChordName('X7')).toBeNull();
    expect(parseChordName('H7')).toBeNull(); // German H out of range (§10)
  });
});
