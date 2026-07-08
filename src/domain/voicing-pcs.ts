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
 * 코드 공식(INTERVALS[qual]) 음 중, 이 특정 보이싱(frets)에서 울리지 않는
 * 피치클래스 집합 = 공식 음 − 해당 보이싱의 피치클래스.
 *
 * 사용자 혼란은 '개별 폼' 단위에서 생긴다(예: 오픈 C9 x30330 그림에서
 * 칩의 G를 찾는 상황). allVoicings 합집합이 아니라 폼마다 어떤 공식 음이
 * 빠졌는지 정확히 판정한다.
 * 도메인 보이싱 로직 무변경 — 순수 read-only 파생 계산.
 */
export function omittedInVoicing(
  root: RootIndex,
  qual: Quality,
  frets: FretArray,
): Set<PitchClass> {
  const sounded = voicingPitchClasses(frets);
  const iv = INTERVALS[qual] || [0, 4, 7];
  const omitted = new Set<PitchClass>();
  iv.forEach((i) => {
    const pc = (((root + i) % 12) + 12) % 12;
    if (!sounded.has(pc)) omitted.add(pc);
  });
  return omitted;
}
