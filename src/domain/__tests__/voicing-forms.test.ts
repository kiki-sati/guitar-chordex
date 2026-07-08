import { describe, it, expect } from 'vitest';
import {
  voicingsByPosition,
  __clearVoicingCache,
  MAX_FORMS_PER_POS,
  MAX_TOTAL_FORMS,
} from '../voicing';
import { requiredPCs } from '../chord';
import { OPEN_MIDI } from '../constants';
import type { FretArray, Quality, VoicingPosition } from '../types';

// ── 헬퍼 (테스트 로컬) ──
function flatForms(positions: VoicingPosition[]): FretArray[] {
  return positions.flatMap((p) => p.forms.map((f) => f.frets));
}
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
function keyOf(frets: FretArray): string {
  return frets.join(',');
}
const ALL_QUALS: Quality[] = ['maj', 'min', '7', 'maj7', 'm7', 'm7b5'];

/**
 * 다형 보이싱 골든 — 음악 검증(결정론).
 * 기대값은 27_voicing_forms_plan.md §0 재현 + 파이프라인 트레이스로 확정(손 추정 금지).
 * 파라미터(오케스트레이터 확정): N=3/pos, M=16 총, pos>=5 개방혼합 배제.
 */
describe('voicingsByPosition — standard forms included (A1/A2)', () => {
  it('C maj7 includes the A-shape barre x-3-5-4-5-3 (user golden)', () => {
    const forms = flatForms(voicingsByPosition(0, 'maj7'));
    expect(forms).toContainEqual(['x', 3, 5, 4, 5, 3]);
  });

  it('C maj7 A-shape barre is FIRST form at pos=3 (standard wins over open-mix)', () => {
    const positions = voicingsByPosition(0, 'maj7');
    const pos3 = positions.find((p) => p.pos === 3);
    expect(pos3).toBeDefined();
    expect(pos3!.forms[0].frets).toEqual(['x', 3, 5, 4, 5, 3]);
    expect(pos3!.forms[0].source).toBe('template');
    expect(pos3!.forms[0].shape).toBe('A');
  });

  it('representative movable forms are present (CAGED table)', () => {
    const cases: Array<[number, Quality, FretArray]> = [
      [0, 'maj7', ['x', 3, 5, 4, 5, 3]], // C maj7 A-shape pos3
      [5, 'maj', [1, 3, 3, 2, 1, 1]], // F maj E-shape pos1
      [11, 'm7', ['x', 2, 4, 2, 3, 2]], // B m7 A-shape pos2
      [7, '7', [3, 5, 3, 4, 3, 3]], // G7 E-shape pos3
      [10, 'maj', ['x', 1, 3, 3, 3, 1]], // Bb maj A-shape pos1
      [3, 'min', ['x', 'x', 1, 3, 4, 2]], // Eb min D-shape pos1
    ];
    for (const [root, qual, expected] of cases) {
      const forms = flatForms(voicingsByPosition(root, qual));
      expect(forms).toContainEqual(expected);
    }
  });

  it('every BARRE_OK quality (5종) at every root has >=1 template form (A3)', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ['maj', 'min', '7', 'maj7', 'm7'] as Quality[]) {
        const positions = voicingsByPosition(root, qual);
        const templates = positions.flatMap((p) =>
          p.forms.filter((f) => f.source === 'template'),
        );
        expect(templates.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('voicingsByPosition — multi-form per position (B1/B2/B3)', () => {
  it('at least one position exposes 2+ distinct forms (B1)', () => {
    const positions = voicingsByPosition(0, 'maj7');
    expect(positions.some((p) => p.forms.length >= 2)).toBe(true);
  });

  it('forms per position never exceed MAX_FORMS_PER_POS (=3) (B2)', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ALL_QUALS) {
        for (const p of voicingsByPosition(root, qual)) {
          expect(p.forms.length).toBeLessThanOrEqual(MAX_FORMS_PER_POS);
        }
      }
    }
  });

  it('total forms never exceed MAX_TOTAL_FORMS (=16) (B2)', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ALL_QUALS) {
        const total = voicingsByPosition(root, qual).reduce(
          (n, p) => n + p.forms.length,
          0,
        );
        expect(total).toBeLessThanOrEqual(MAX_TOTAL_FORMS);
      }
    }
  });

  it('no duplicate frets across all forms (B3)', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ALL_QUALS) {
        const forms = flatForms(voicingsByPosition(root, qual));
        const keys = forms.map(keyOf);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it('pos is unique across position groups', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ALL_QUALS) {
        const positions = voicingsByPosition(root, qual);
        const posKeys = positions.map((p) => p.pos);
        expect(new Set(posKeys).size).toBe(posKeys.length);
      }
    }
  });
});

describe('voicingsByPosition — musical validity (C1)', () => {
  it('every form: >=4 sounded, contiguous, span<=4, required pcs present', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ALL_QUALS) {
        const req = requiredPCs(root, qual);
        for (const fr of flatForms(voicingsByPosition(root, qual))) {
          const sounded = nonMuted(fr);
          // >=4 strings
          expect(sounded.length).toBeGreaterThanOrEqual(4);
          // contiguous
          for (let s = sounded[0]; s <= sounded[sounded.length - 1]; s++) {
            expect(fr[s]).not.toBe('x');
          }
          // span <= 4
          const fretted = fr.filter(
            (f) => f !== 'x' && (f as number) > 0,
          ) as number[];
          if (fretted.length) {
            expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(
              4,
            );
          }
          // required pcs
          const pcs = pcsOf(fr);
          for (const r of req) expect(pcs.has(r)).toBe(true);
        }
      }
    }
  });
});

describe('voicingsByPosition — non-realistic exclusion (C2)', () => {
  it('C maj7 does NOT include high-position open-mix forms', () => {
    const forms = flatForms(voicingsByPosition(0, 'maj7'));
    expect(forms).not.toContainEqual([0, 14, 14, 0, 13, 12]);
    expect(forms).not.toContainEqual([0, 14, 14, 0, 13, 0]);
  });

  it('no form at pos>=5 mixes open strings (0)', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ALL_QUALS) {
        for (const p of voicingsByPosition(root, qual)) {
          if (p.pos >= 5) {
            for (const f of p.forms) {
              expect(f.frets.some((x) => x === 0)).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe('voicingsByPosition — determinism (D1/D2)', () => {
  it('is deterministic across cache clear (deep equal)', () => {
    const a = voicingsByPosition(0, 'maj7');
    __clearVoicingCache();
    const b = voicingsByPosition(0, 'maj7');
    expect(a).toEqual(b);
  });

  it('position groups are sorted by pos ascending', () => {
    for (let root = 0; root < 12; root++) {
      for (const qual of ALL_QUALS) {
        const positions = voicingsByPosition(root, qual);
        const posKeys = positions.map((p) => p.pos);
        expect(posKeys).toEqual([...posKeys].sort((x, y) => x - y));
      }
    }
  });

  it('within a position, forms have an explicit deterministic order (tie-break)', () => {
    // Cmaj7 pos=3: template A-shape first, then enum forms in lex order.
    const positions = voicingsByPosition(0, 'maj7');
    const pos3 = positions.find((p) => p.pos === 3)!;
    expect(pos3.forms.map((f) => f.frets)).toEqual([
      ['x', 3, 5, 4, 5, 3], // template/A
      ['x', 3, 5, 0, 0, 0], // enum (open-mix, later)
      ['x', 3, 5, 4, 0, 0], // enum
    ]);
  });
});
