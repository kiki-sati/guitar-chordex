import { describe, it, expect } from 'vitest';
import { buildChord, barre, chordPCs, requiredPCs } from '../chord';

describe('buildChord — priority order', () => {
  it('① OPEN: C major returns the open-chord voicing', () => {
    const c = buildChord(0, 'maj');
    expect(c.frets).toEqual(['x', 3, 2, 0, 1, 0]);
    expect(c.name).toBe('C');
    expect(c.root).toBe(0);
    expect(c.qualKey).toBe('maj');
    expect(c.key).toBe('C');
  });

  it('① OPEN: Cmaj7 returns the open-chord voicing', () => {
    const c = buildChord(0, 'maj7');
    expect(c.frets).toEqual(['x', 3, 2, 0, 0, 0]);
    expect(c.name).toBe('Cmaj7');
  });

  it('③ BARRE: F major uses E-shape barre at base 1', () => {
    const c = buildChord(5, 'maj');
    expect(c.frets).toEqual([1, 3, 3, 2, 1, 1]);
    expect(c.name).toBe('F');
  });

  it('② m7b5 special: D m7b5 uses the dedicated formula', () => {
    // n = ((2-9)+12)%12 = 5 → ['x',5,6,5,6,'x']
    const c = buildChord(2, 'm7b5');
    expect(c.frets).toEqual(['x', 5, 6, 5, 6, 'x']);
    expect(c.name).toBe('Dm7♭5');
  });

  it('name = noteName + SUF', () => {
    expect(buildChord(9, 'min').name).toBe('Am'); // A minor
    expect(buildChord(7, '7').name).toBe('G7');
    expect(buildChord(0, 'dim').name).toBe('Cdim');
  });

  it('always returns a 6-string fret array', () => {
    expect(buildChord(0, 'maj').frets).toHaveLength(6);
    expect(buildChord(3, '9').frets).toHaveLength(6); // bestVoicing path
    expect(buildChord(2, 'm7b5').frets).toHaveLength(6);
    expect(buildChord(5, 'maj').frets).toHaveLength(6);
  });
});

describe('barre — E/A shape selection', () => {
  it('F major: E-shape at base 1', () => {
    expect(barre(5, 'maj')).toEqual([1, 3, 3, 2, 1, 1]);
  });

  it('B major: A-shape (eBase>aBase>0) at base 2', () => {
    // eBase = ((11-4)+12)%12 = 7, aBase = ((11-9)+12)%12 = 2; 2<7 → useA, base 2
    // A.maj = ['x',0,2,2,2,0] → ['x',2,4,4,4,2]
    expect(barre(11, 'maj')).toEqual(['x', 2, 4, 4, 4, 2]);
  });

  it('E major: eBase===0 and aBase>0 stays E-shape (base 0)', () => {
    // eBase = ((4-4)+12)%12 = 0, aBase = ((4-9)+12)%12 = 7 → eBase===0, aBase>0 → useA base 7
    // A.maj = ['x',0,2,2,2,0] → ['x',7,9,9,9,7]
    expect(barre(4, 'maj')).toEqual(['x', 7, 9, 9, 9, 7]);
  });
});

describe('chordPCs / requiredPCs', () => {
  it('chordPCs of C major = {0,4,7}', () => {
    expect([...chordPCs(0, 'maj')].sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('requiredPCs keeps <=4 notes', () => {
    const req = requiredPCs(0, '13'); // 7 intervals -> trimmed
    expect(req.size).toBeLessThanOrEqual(4);
  });

  it('requiredPCs drops perfect 5th (7) first when too many notes', () => {
    // maj9 intervals = [0,4,7,11,14] -> 5 semitone classes {0,4,7,11,2}
    // drop order [7,2,5]: remove 7 -> {0,4,11,2} (length 4) -> stop
    const req = requiredPCs(0, 'maj9');
    expect(req.has(7)).toBe(false); // perfect 5th dropped
    expect(req.has(0)).toBe(true);
    expect(req.has(4)).toBe(true);
    expect(req.has(11)).toBe(true);
    expect(req.has(2)).toBe(true); // the 9th (14%12)
    expect(req.size).toBe(4);
  });
});
