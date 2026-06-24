import { describe, it, expect } from 'vitest';
import { noteName, dateStr, normalizeQuery } from '../notes';

describe('noteName', () => {
  it('maps 0..11 to NOTE names', () => {
    expect(noteName(0)).toBe('C');
    expect(noteName(4)).toBe('E');
    expect(noteName(11)).toBe('B');
  });
  it('wraps values >= 12', () => {
    expect(noteName(12)).toBe('C');
    expect(noteName(13)).toBe('C#');
  });
  it('wraps negative values', () => {
    expect(noteName(-1)).toBe('B');
    expect(noteName(-12)).toBe('C');
  });
});

describe('dateStr', () => {
  it('formats YYYY-MM-DD with zero padding', () => {
    expect(dateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('normalizeQuery', () => {
  it('lowercases', () => {
    expect(normalizeQuery('AM7')).toBe('am7');
  });
  it('replaces flat/sharp unicode with b/#', () => {
    expect(normalizeQuery('C♭')).toBe('cb');
    expect(normalizeQuery('F♯')).toBe('f#');
  });
});
