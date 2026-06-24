import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, KEYS } from '../persist';

describe('persist round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('seeds on first load when localStorage is empty', () => {
    const p = load();
    expect(Object.keys(p.grass).length).toBeGreaterThan(0);
    expect(p.journal.length).toBeGreaterThan(0);
    expect(p.drills.length).toBeGreaterThan(0);
    expect(p.collected.length).toBe(4);
    expect(p.lang).toBe('ko');
  });

  it('save then load preserves grass/journal/drills/collected', () => {
    const grass = { '2026-06-24': 3 };
    const journal = [
      { id: 'j1', date: '2026-06-24', title: 't', minutes: 10, chords: ['C'], notes: 'n' },
    ];
    const drills = [{ id: 'd1', title: 'x', target: 5, count: 2 }];
    const collected = [{ name: 'C', frets: ['x', 3, 2, 0, 1, 0] as (number | 'x')[], key: 'C' }];
    save({ grass, journal, drills, collected });

    const p = load();
    expect(p.grass).toEqual(grass);
    expect(p.journal).toEqual(journal);
    expect(p.drills).toEqual(drills);
    expect(p.collected).toEqual(collected);
  });

  it('JSON serialization is safe (no Date objects in persisted slices)', () => {
    save({ grass: { '2026-06-24': 1 } });
    const raw = localStorage.getItem(KEYS.grass);
    expect(raw).toBe('{"2026-06-24":1}');
  });
});
