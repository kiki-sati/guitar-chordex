import { describe, it, expect } from 'vitest';
import { voicingPitchClasses } from '../voicing-pcs';

describe('voicingPitchClasses', () => {
  it('C major x32010 -> {C,E,G} = {0,4,7}', () => {
    // OPENPC=[4,9,2,7,11,4]; s1 f3->(9+3)%12=0(C); s2 f2->(2+2)%12=4(E);
    // s3 f0->(7+0)%12=7(G); s4 f1->(11+1)%12=0(C); s5 f0->(4+0)%12=4(E)
    const pcs = voicingPitchClasses(['x', 3, 2, 0, 1, 0]);
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('ignores muted strings', () => {
    // only string 0 open E -> {4}
    const pcs = voicingPitchClasses([0, 'x', 'x', 'x', 'x', 'x']);
    expect([...pcs].sort((a, b) => a - b)).toEqual([4]);
  });

  it('all muted -> empty set', () => {
    const pcs = voicingPitchClasses(['x', 'x', 'x', 'x', 'x', 'x']);
    expect(pcs.size).toBe(0);
  });

  it('open E major 022100 -> {E,B,G#} = {4,11,8}', () => {
    // s0 f0->4(E); s1 f2->(9+2)%12=11(B); s2 f2->(2+2)%12=4(E);
    // s3 f1->(7+1)%12=8(G#); s4 f0->11(B); s5 f0->4(E)
    const pcs = voicingPitchClasses([0, 2, 2, 1, 0, 0]);
    expect([...pcs].sort((a, b) => a - b)).toEqual([4, 8, 11]);
  });
});
