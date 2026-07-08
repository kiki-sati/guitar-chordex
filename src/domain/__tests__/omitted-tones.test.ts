import { describe, it, expect } from 'vitest';
import { omittedFormulaPCs } from '../voicing-pcs';
import { allVoicings } from '../voicing';

describe('omittedFormulaPCs', () => {
  it('C major (root 0): no omission -> empty set', () => {
    const voicings = allVoicings(0, 'maj');
    const omitted = omittedFormulaPCs(0, 'maj', voicings);
    expect(omitted.size).toBe(0);
  });

  it('C9 (root 0): 5th (G = pc 7) omitted in every voicing', () => {
    const voicings = allVoicings(0, '9');
    const omitted = omittedFormulaPCs(0, '9', voicings);
    // requiredPCs drops the 5th (interval 7) for 5-note chords, so no
    // displayed voicing should contain G (pc 7).
    expect(omitted.has(7)).toBe(true);
  });

  it('returns pcs that appear in NO displayed voicing', () => {
    // craft a single voicing that only sounds {C,E} = {0,4}
    const single = [['x', 3, 2, 'x', 'x', 'x'] as (number | 'x')[]];
    // formula pretends to require {0,4,7}: 7 (G) is absent -> omitted
    const omitted = omittedFormulaPCs(0, 'maj', single);
    expect(omitted.has(7)).toBe(true);
    expect(omitted.has(0)).toBe(false);
    expect(omitted.has(4)).toBe(false);
  });

  it('empty voicing list -> all formula pcs omitted', () => {
    const omitted = omittedFormulaPCs(0, 'maj', []);
    // maj = {0,4,7} all omitted
    expect([...omitted].sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });
});
