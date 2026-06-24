import { describe, it, expect } from 'vitest';
import { scaleNotes } from '../scale';

describe('scaleNotes', () => {
  it('C major', () => {
    expect(scaleNotes(0, 'major')).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  it('A minor', () => {
    expect(scaleNotes(9, 'minor')).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });
  it('C major pentatonic', () => {
    expect(scaleNotes(0, 'majpent')).toEqual([0, 2, 4, 7, 9]);
  });
  it('A minor pentatonic', () => {
    expect(scaleNotes(9, 'minpent')).toEqual([9, 0, 2, 4, 7]);
  });
  it('C blues', () => {
    expect(scaleNotes(0, 'blues')).toEqual([0, 3, 5, 6, 7, 10]);
  });
});
