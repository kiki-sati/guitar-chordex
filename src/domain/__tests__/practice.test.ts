import { describe, it, expect } from 'vitest';
import { stats, level, buildGrass } from '../practice';
import { dateStr } from '../notes';
import type { GrassMap } from '../types';

function dayOffset(base: Date, o: number): string {
  const d = new Date(base);
  d.setDate(base.getDate() - o);
  return dateStr(d);
}

describe('level — boundaries', () => {
  it('matches c<=0?0:c<2?1:c<4?2:c<6?3:4', () => {
    expect(level(0)).toBe(0);
    expect(level(-1)).toBe(0);
    expect(level(1)).toBe(1);
    expect(level(2)).toBe(2);
    expect(level(3)).toBe(2);
    expect(level(4)).toBe(3);
    expect(level(5)).toBe(3);
    expect(level(6)).toBe(4);
    expect(level(10)).toBe(4);
  });
});

describe('stats', () => {
  it('total and days count entries with count>0', () => {
    const today = new Date(2026, 5, 24);
    const g: GrassMap = {
      [dayOffset(today, 0)]: 2,
      [dayOffset(today, 1)]: 3,
      [dayOffset(today, 10)]: 1,
    };
    const s = stats(g, today);
    expect(s.total).toBe(6);
    expect(s.days).toBe(3);
  });

  it('streak counts consecutive days back from today', () => {
    const today = new Date(2026, 5, 24);
    const g: GrassMap = {
      [dayOffset(today, 0)]: 1,
      [dayOffset(today, 1)]: 2,
      [dayOffset(today, 2)]: 1,
      // gap at offset 3
      [dayOffset(today, 4)]: 5,
    };
    expect(stats(g, today).streak).toBe(3);
  });

  it('streak: today missing still counts from yesterday (continue, not break)', () => {
    const today = new Date(2026, 5, 24);
    const g: GrassMap = {
      // no today
      [dayOffset(today, 1)]: 1,
      [dayOffset(today, 2)]: 1,
    };
    expect(stats(g, today).streak).toBe(2);
  });

  it('week sums the last 7 days', () => {
    const today = new Date(2026, 5, 24);
    const g: GrassMap = {
      [dayOffset(today, 0)]: 1,
      [dayOffset(today, 3)]: 2,
      [dayOffset(today, 6)]: 3,
      [dayOffset(today, 7)]: 9, // outside window
    };
    expect(stats(g, today).week).toBe(6);
  });

  it('empty grass → all zeros', () => {
    const s = stats({}, new Date(2026, 5, 24));
    expect(s).toEqual({ total: 0, days: 0, streak: 0, week: 0 });
  });
});

describe('buildGrass', () => {
  it('produces ~53 week columns each of length 7', () => {
    const today = new Date(2026, 5, 24);
    const weeks = buildGrass({}, today);
    expect(weeks.length).toBeGreaterThanOrEqual(53);
    expect(weeks.length).toBeLessThanOrEqual(54);
    for (const w of weeks) expect(w).toHaveLength(7);
  });

  it('fills counts and levels from the grass map', () => {
    const today = new Date(2026, 5, 24);
    const ds = dateStr(today);
    const weeks = buildGrass({ [ds]: 4 }, today);
    const flat = weeks.flat().filter((c) => c && c.ds === ds);
    expect(flat).toHaveLength(1);
    expect(flat[0]!.count).toBe(4);
    expect(flat[0]!.level).toBe(3);
  });

  it('pads days after today with null', () => {
    const today = new Date(2026, 5, 24);
    const weeks = buildGrass({}, today);
    const lastWeek = weeks[weeks.length - 1];
    // today is the last non-null cell; cells after it (if any) are null
    const todayIdx = lastWeek.findIndex((c) => c && c.ds === dateStr(today));
    expect(todayIdx).toBeGreaterThanOrEqual(0);
    for (let i = todayIdx + 1; i < 7; i++) {
      expect(lastWeek[i]).toBeNull();
    }
  });
});
