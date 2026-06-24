import { describe, it, expect } from 'vitest';
import { diatonic } from '../diatonic';

describe('diatonic — C major', () => {
  const chords = diatonic(0, 'major');

  it('returns 7 chords', () => {
    expect(chords).toHaveLength(7);
  });

  it('has correct names (Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5)', () => {
    expect(chords.map((c) => c.name)).toEqual([
      'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5',
    ]);
  });

  it('has correct roman numerals', () => {
    expect(chords.map((c) => c.roman)).toEqual([
      'Imaj7', 'ii m7', 'iii m7', 'IV maj7', 'V7', 'vi m7', 'viiø',
    ]);
  });

  it('assigns sequential keys d0..d6', () => {
    expect(chords.map((c) => c.key)).toEqual([
      'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6',
    ]);
  });
});

describe('diatonic — A minor', () => {
  const chords = diatonic(9, 'minor');

  it('returns 7 chords with minor romans', () => {
    expect(chords.map((c) => c.roman)).toEqual([
      'i m7', 'iiø', '♭III maj7', 'iv m7', 'v m7', '♭VI maj7', '♭VII7',
    ]);
  });

  it('starts on Am7', () => {
    expect(chords[0].name).toBe('Am7');
  });
});
