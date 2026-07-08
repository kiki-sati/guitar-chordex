import { describe, it, expect } from 'vitest';
import { QUALITY_ALIASES } from '../aliases';
import { INTERVALS } from '../constants';
import type { Quality } from '../types';

describe('QUALITY_ALIASES — golden mappings (plan §2.2)', () => {
  const cases: Array<[string, Quality]> = [
    // maj7 family — keys preserve case (uppercase M) so parser can distinguish Am7≠AM7
    ['M7', 'maj7'],
    ['Δ', 'maj7'],
    ['Δ7', 'maj7'],
    ['ma7', 'maj7'],
    ['major7', 'maj7'],
    // add2 = add9 (same PC set: 2 = 9 mod 12)
    ['add2', 'add9'],
    ['add9', 'add9'],
    // parenthesized tension → base quality
    ['7(9)', '9'],
    ['7(b9)', '7b9'],
    ['7(#9)', '7#9'],
    ['7(11)', '11'],
    ['7(13)', '13'],
    ['m7(9)', 'm9'],
    ['m7(11)', 'm11'],
    ['m7(b5)', 'm7b5'],
    ['maj7(9)', 'maj9'],
    ['maj7(11)', 'maj11'],
    ['maj7(#11)', 'maj#11'],
  ];
  for (const [alias, qual] of cases) {
    it(`"${alias}" → ${qual}`, () => {
      expect(QUALITY_ALIASES[alias]).toBe(qual);
    });
  }

  it('every alias target is a real Quality (present in INTERVALS)', () => {
    for (const target of Object.values(QUALITY_ALIASES)) {
      expect(INTERVALS[target]).toBeDefined();
    }
  });

  it('does not fold minor m7 into maj7 (case-sensitive M only)', () => {
    // lowercase 'm7' must NOT be an alias to maj7 — it is a real quality handled elsewhere
    expect(QUALITY_ALIASES['m7']).not.toBe('maj7');
  });
});
