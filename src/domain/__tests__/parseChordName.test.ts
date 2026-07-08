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

describe('parseChordName — slash chords (§2.3 PR-B activation)', () => {
  it('G/B → root G maj, bass B', () => {
    expect(parseChordName('G/B')).toEqual({ root: 7, qualKey: 'maj', bass: 11, display: 'G/B' });
  });
  it('Gadd2/B → body add9 (add2 alias), bass B', () => {
    const p = parseChordName('Gadd2/B');
    expect(p).toEqual({ root: 7, qualKey: 'add9', bass: 11, display: 'Gadd2/B' });
  });
  it('Ab/C → root G#(8) maj, bass C(0)', () => {
    expect(parseChordName('Ab/C')).toEqual({ root: 8, qualKey: 'maj', bass: 0, display: 'Ab/C' });
  });
  it('C/D → root C maj, bass D', () => {
    expect(parseChordName('C/D')).toEqual({ root: 0, qualKey: 'maj', bass: 2, display: 'C/D' });
  });
  it('Db/Eb → root Db(1) maj, bass Eb(3)', () => {
    expect(parseChordName('Db/Eb')).toEqual({ root: 1, qualKey: 'maj', bass: 3, display: 'Db/Eb' });
  });
  it('A/B → root A maj, bass B (on-chord)', () => {
    expect(parseChordName('A/B')).toEqual({ root: 9, qualKey: 'maj', bass: 11, display: 'A/B' });
  });
  it('AM7/B → body maj7 preserved (case-sensitive) + bass B', () => {
    expect(parseChordName('AM7/B')).toEqual({ root: 9, qualKey: 'maj7', bass: 11, display: 'AM7/B' });
  });
  it('invalid bass (G/H) → null', () => {
    expect(parseChordName('G/H')).toBeNull();
  });
  it('invalid bass with trailing junk (C/Db7) → null', () => {
    expect(parseChordName('C/Db7')).toBeNull();
  });
  it('invalid body (X/B) → null', () => {
    expect(parseChordName('X/B')).toBeNull();
  });
});

describe('parseChordName — failure cases', () => {
  it('empty string → null', () => {
    expect(parseChordName('')).toBeNull();
    expect(parseChordName('   ')).toBeNull();
  });
  it('unknown quality → null', () => {
    expect(parseChordName('Cwizzle99')).toBeNull();
  });
  it('non-note leading char → null', () => {
    expect(parseChordName('X7')).toBeNull();
    expect(parseChordName('H7')).toBeNull(); // German H out of range (§10)
  });
});
