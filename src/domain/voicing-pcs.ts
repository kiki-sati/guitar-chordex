import { OPENPC, INTERVALS } from './constants';
import type { FretArray, PitchClass, Quality, RootIndex } from './types';

/**
 * 한 보이싱(frets)에서 실제로 울리는 피치클래스 집합. (read-only 헬퍼)
 * 뮤트('x')는 제외, 각 현은 (OPENPC[i] + fret) % 12.
 * 보이싱 알고리즘/상수는 무변경 — 표시용 파생 계산만 수행한다.
 * (음이름 계산은 ChordDiagram tones variant와 동일 공식)
 */
export function voicingPitchClasses(frets: FretArray): Set<PitchClass> {
  const set = new Set<PitchClass>();
  frets.forEach((f, s) => {
    if (f !== 'x') set.add((OPENPC[s] + f) % 12);
  });
  return set;
}

/**
 * 코드 공식(INTERVALS[qual]) 음 중, 표시 중인 어떤 보이싱에서도 울리지 않는
 * 피치클래스 집합. (재즈 관례상 5도 등 비필수음을 생략하는 보이싱이 있으면 여기 잡힘)
 * 판정: 전체 보이싱의 피치클래스 합집합에 없는 공식 음 = 생략된 음.
 * 도메인 보이싱 로직 무변경 — 순수 read-only 파생 계산.
 */
export function omittedFormulaPCs(
  root: RootIndex,
  qual: Quality,
  voicings: FretArray[],
): Set<PitchClass> {
  const sounded = new Set<PitchClass>();
  for (const v of voicings) {
    for (const pc of voicingPitchClasses(v)) sounded.add(pc);
  }
  const iv = INTERVALS[qual] || [0, 4, 7];
  const omitted = new Set<PitchClass>();
  iv.forEach((i) => {
    const pc = ((root + i) % 12 + 12) % 12;
    if (!sounded.has(pc)) omitted.add(pc);
  });
  return omitted;
}
