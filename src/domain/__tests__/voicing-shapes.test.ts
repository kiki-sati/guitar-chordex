import { describe, it, expect } from 'vitest';
import { CAGED_SHAPES, transposeShape } from '../voicing-shapes';
import type { MovableShape } from '../voicing-shapes';

/**
 * CAGED 무버블 쉐입 트랜스포즈 골든.
 * 기대값 = 27_voicing_forms_plan.md §0 재현 스크립트 출력(정본)과 1:1.
 * transposeShape는 결정론적 순수 함수: barre 프렛 + (barre+12) 옥타브 두 폼 반환.
 */

// 특정 shape/root에서 나온 폼들 중 첫 옥타브(barre)만 뽑는 헬퍼.
function firstOctave(shape: MovableShape, root: number) {
  return transposeShape(shape, root)[0];
}

describe('transposeShape — CAGED movable shapes (golden)', () => {
  it('C maj7 A-shape (rootString=1) transposes to x-3-5-4-5-3', () => {
    const aShape = CAGED_SHAPES.maj7!.find((s) => s.rootString === 1)!;
    expect(firstOctave(aShape, 0)).toEqual(['x', 3, 5, 4, 5, 3]);
  });

  it('C maj7 E-shape (rootString=0) transposes to 8-10-9-9-8-8', () => {
    const eShape = CAGED_SHAPES.maj7!.find((s) => s.rootString === 0)!;
    expect(firstOctave(eShape, 0)).toEqual([8, 10, 9, 9, 8, 8]);
  });

  it('F maj E-shape (rootString=0) transposes to 1-3-3-2-1-1', () => {
    const eShape = CAGED_SHAPES.maj!.find((s) => s.rootString === 0)!;
    expect(firstOctave(eShape, 5)).toEqual([1, 3, 3, 2, 1, 1]);
  });

  it('B m7 A-shape (rootString=1) transposes to x-2-4-2-3-2', () => {
    const aShape = CAGED_SHAPES.m7!.find((s) => s.rootString === 1)!;
    expect(firstOctave(aShape, 11)).toEqual(['x', 2, 4, 2, 3, 2]);
  });

  it('G 7 E-shape (rootString=0) transposes to 3-5-3-4-3-3', () => {
    const eShape = CAGED_SHAPES['7']!.find((s) => s.rootString === 0)!;
    expect(firstOctave(eShape, 7)).toEqual([3, 5, 3, 4, 3, 3]);
  });

  it('B♭ maj A-shape (rootString=1) transposes to x-1-3-3-3-1', () => {
    const aShape = CAGED_SHAPES.maj!.find((s) => s.rootString === 1)!;
    expect(firstOctave(aShape, 10)).toEqual(['x', 1, 3, 3, 3, 1]);
  });

  it('E♭ min D-shape (rootString=2) transposes to x-x-1-3-4-2', () => {
    const dShape = CAGED_SHAPES.min!.find((s) => s.rootString === 2)!;
    expect(firstOctave(dShape, 3)).toEqual(['x', 'x', 1, 3, 4, 2]);
  });

  it('returns two octaves (barre and barre+12)', () => {
    const aShape = CAGED_SHAPES.maj7!.find((s) => s.rootString === 1)!;
    const forms = transposeShape(aShape, 0);
    expect(forms).toHaveLength(2);
    expect(forms[0]).toEqual(['x', 3, 5, 4, 5, 3]);
    expect(forms[1]).toEqual(['x', 15, 17, 16, 17, 15]); // +12 octave
  });

  it('preserves muted strings (x) across transpose', () => {
    const aShape = CAGED_SHAPES.m7!.find((s) => s.rootString === 1)!;
    const [form] = transposeShape(aShape, 11);
    expect(form[0]).toBe('x'); // 6th string muted in A-shape
  });

  it('CAGED_SHAPES offsets match chord.ts barre tables (E/A shapes)', () => {
    // Cross-check: maj E-shape offsets = [0,2,2,1,0,0]; A-shape = [x,0,2,2,2,0]
    const majE = CAGED_SHAPES.maj!.find((s) => s.rootString === 0)!;
    const majA = CAGED_SHAPES.maj!.find((s) => s.rootString === 1)!;
    expect(majE.offsets).toEqual([0, 2, 2, 1, 0, 0]);
    expect(majA.offsets).toEqual(['x', 0, 2, 2, 2, 0]);
  });
});
