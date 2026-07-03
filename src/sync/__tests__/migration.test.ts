import { describe, it, expect, beforeEach } from 'vitest';
import { hasLegacyData, loadLegacy, legacyToChanges } from '../migration';
import { KEYS } from '../../state/persist';
import type { PersistedState } from '../../state/persist';

beforeEach(() => localStorage.clear());

describe('hasLegacyData (B6-1)', () => {
  it('B6-1: returns false for empty localStorage (no seed mis-detection)', () => {
    expect(hasLegacyData()).toBe(false);
  });

  it('B6-1: returns true when a legacy cs_* key has real data', () => {
    localStorage.setItem(KEYS.grass, JSON.stringify({ '2026-07-01': 3 }));
    expect(hasLegacyData()).toBe(true);
  });

  it('returns true when legacy journal has entries', () => {
    localStorage.setItem(
      KEYS.journal,
      JSON.stringify([{ id: 'j1', date: 'd', title: 't', minutes: 1, chords: [], notes: '' }]),
    );
    expect(hasLegacyData()).toBe(true);
  });

  it('returns false when legacy keys hold only empty collections', () => {
    localStorage.setItem(KEYS.grass, JSON.stringify({}));
    localStorage.setItem(KEYS.journal, JSON.stringify([]));
    localStorage.setItem(KEYS.drills, JSON.stringify([]));
    localStorage.setItem(KEYS.collected, JSON.stringify([]));
    expect(hasLegacyData()).toBe(false);
  });
});

describe('loadLegacy (B6-2)', () => {
  it('B6-2: restores PersistedState from legacy keys without seed mixing', () => {
    localStorage.setItem(KEYS.grass, JSON.stringify({ d1: 2 }));
    localStorage.setItem(KEYS.lang, JSON.stringify('en'));
    const p = loadLegacy();
    expect(p.grass).toEqual({ d1: 2 });
    expect(p.lang).toBe('en');
    // no seed contamination — journal/drills/collected empty
    expect(p.journal).toEqual([]);
    expect(p.drills).toEqual([]);
    expect(p.collected).toEqual([]);
  });
});

describe('legacyToChanges (B6-3)', () => {
  it('B6-3: converts a PersistedState into grass/journal/drill/collected/lang changes', () => {
    const p: PersistedState = {
      grass: { d1: 1, d2: 2 },
      journal: [{ id: 'j1', date: 'd', title: 't', minutes: 1, chords: [], notes: '' }],
      drills: [{ id: 'dr1', title: 'x', target: 5, count: 3 }],
      collected: [{ name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' }],
      lang: 'en',
    };
    const changes = legacyToChanges(p);
    expect(changes.filter((c) => c.kind === 'grass')).toHaveLength(2);
    expect(changes.filter((c) => c.kind === 'journal')).toHaveLength(1);
    expect(changes.filter((c) => c.kind === 'drill')).toHaveLength(1);
    expect(changes.filter((c) => c.kind === 'collected')).toHaveLength(1);
    expect(changes.filter((c) => c.kind === 'lang')).toHaveLength(1);

    // drill upsert carries sortOrder = index
    const drillChange = changes.find((c) => c.kind === 'drill');
    expect(drillChange).toEqual({
      kind: 'drill',
      op: 'upsert',
      drill: p.drills[0],
      sortOrder: 0,
    });
  });

  it('emits nothing for empty state (except no lang duplication concerns)', () => {
    const p: PersistedState = {
      grass: {}, journal: [], drills: [], collected: [], lang: 'ko',
    };
    const changes = legacyToChanges(p);
    // only lang change (single setting) — grass/journal/drill/collected empty
    expect(changes.filter((c) => c.kind !== 'lang')).toEqual([]);
  });
});
