import { describe, it, expect } from 'vitest';
import { computeDiagram } from '../diagram';
import type { FretArray } from '../types';

describe('computeDiagram', () => {
  it('1-fret chord (C major open) → start 1, showNut true', () => {
    const g = computeDiagram(['x', 3, 2, 0, 1, 0]);
    expect(g.start).toBe(1);
    expect(g.showNut).toBe(true);
    expect(g.span).toBe(5);
  });

  it('classifies mute (x) and open (0) markers', () => {
    const g = computeDiagram(['x', 3, 2, 0, 1, 0]);
    expect(g.markers).toContainEqual({ s: 0, type: 'mute' });
    expect(g.markers).toContainEqual({ s: 3, type: 'open' });
    expect(g.markers).toContainEqual({ s: 5, type: 'open' });
  });

  it('dot rows are computed relative to start (start 1)', () => {
    const g = computeDiagram(['x', 3, 2, 0, 1, 0]);
    // s1 fret3 → row3, s2 fret2 → row2, s4 fret1 → row1
    expect(g.dots).toContainEqual({ s: 1, row: 3 });
    expect(g.dots).toContainEqual({ s: 2, row: 2 });
    expect(g.dots).toContainEqual({ s: 4, row: 1 });
  });

  it('high-fret chord (max>5) shifts start to min fret, showNut false', () => {
    // frets up at 7..9 → mx=9>5 → start = max(1, mn=7) = 7
    const frets: FretArray = ['x', 7, 9, 9, 9, 7];
    const g = computeDiagram(frets);
    expect(g.start).toBe(7);
    expect(g.showNut).toBe(false);
    // s1 fret7 → row 7-7+1 = 1
    expect(g.dots).toContainEqual({ s: 1, row: 1 });
    expect(g.dots).toContainEqual({ s: 2, row: 3 });
  });

  it('chord with max fret <=5 stays at start 1 even if min>1', () => {
    // F barre [1,3,3,2,1,1] → mx=3 (<=5) → start 1
    const g = computeDiagram([1, 3, 3, 2, 1, 1]);
    expect(g.start).toBe(1);
    expect(g.showNut).toBe(true);
  });

  it('all-muted chord → start 1, no dots', () => {
    const g = computeDiagram(['x', 'x', 'x', 'x', 'x', 'x']);
    expect(g.start).toBe(1);
    expect(g.dots).toHaveLength(0);
    expect(g.markers).toHaveLength(6);
  });
});
