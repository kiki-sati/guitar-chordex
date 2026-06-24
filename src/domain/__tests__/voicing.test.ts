import { describe, it, expect } from 'vitest';
import { bestVoicing, allVoicings, __clearVoicingCache } from '../voicing';
import { requiredPCs } from '../chord';
import { OPEN_MIDI } from '../constants';
import type { FretArray } from '../types';

function nonMuted(frets: FretArray): number[] {
  return frets
    .map((f, s) => ({ f, s }))
    .filter((x) => x.f !== 'x')
    .map((x) => x.s);
}

function pcsOf(frets: FretArray): Set<number> {
  const set = new Set<number>();
  frets.forEach((f, s) => {
    if (f !== 'x') set.add((OPEN_MIDI[s] + (f as number)) % 12);
  });
  return set;
}

describe('bestVoicing — musical validity invariants', () => {
  it('returns a 6-string array', () => {
    expect(bestVoicing(0, '9')).toHaveLength(6);
  });

  it('contains all required pitch classes (C9)', () => {
    const frets = bestVoicing(0, '9');
    const pcs = pcsOf(frets);
    const req = requiredPCs(0, '9');
    for (const r of req) expect(pcs.has(r)).toBe(true);
  });

  it('is contiguous (no muted strings between first and last sounded)', () => {
    const frets = bestVoicing(0, '9');
    const sounded = nonMuted(frets);
    const first = sounded[0];
    const last = sounded[sounded.length - 1];
    for (let s = first; s <= last; s++) {
      expect(frets[s]).not.toBe('x');
    }
  });

  it('fret span <= 4', () => {
    const frets = bestVoicing(0, '9');
    const fretted = frets.filter((f) => f !== 'x' && (f as number) > 0) as number[];
    if (fretted.length) {
      expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(4);
    }
  });

  it('plays at least 4 strings', () => {
    const frets = bestVoicing(0, '9');
    expect(nonMuted(frets).length).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic (cache does not change result)', () => {
    const a = bestVoicing(7, 'm9');
    __clearVoicingCache();
    const b = bestVoicing(7, 'm9');
    expect(a).toEqual(b);
  });
});

describe('allVoicings', () => {
  it('returns at most 10 forms', () => {
    expect(allVoicings(0, '9').length).toBeLessThanOrEqual(10);
  });

  it('forms are sorted by position ascending', () => {
    const forms = allVoicings(0, '9');
    const positions = forms.map((fr) => {
      const fretted = fr.filter((f) => f !== 'x' && (f as number) > 0) as number[];
      return fretted.length ? Math.min(...fretted) : 0;
    });
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it('every form satisfies required pitch classes', () => {
    const req = requiredPCs(0, '9');
    for (const fr of allVoicings(0, '9')) {
      const pcs = pcsOf(fr);
      for (const r of req) expect(pcs.has(r)).toBe(true);
    }
  });

  it('no duplicate positions among returned forms', () => {
    const forms = allVoicings(2, 'maj9');
    const positions = forms.map((fr) => {
      const fretted = fr.filter((f) => f !== 'x' && (f as number) > 0) as number[];
      return fretted.length ? Math.min(...fretted) : 0;
    });
    expect(new Set(positions).size).toBe(positions.length);
  });
});
