import type { Quality } from './types';

/**
 * 코드 표기 별칭 접미사 → Quality.
 *
 * PR-A: 도메인 quality 무변경 — 이 테이블은 "매핑 계층"이다.
 * 사용자가 실전 악보에서 쓰는 표기 변형(`M7`, `add2`, `7(9)`, `m7(11)`, `Δ` 등)을
 * 기존 58종 quality 중 하나로 접는다(fold). quality 자체는 추가하지 않는다.
 *
 * ── 케이스 규칙 (중요) ──
 * `M7`/`Δ` 계열 키는 **대문자 M을 보존**한다. 파서(parseChordName)는 접미사 첫 글자의
 * 케이스로 maj7(대문자 M) vs minor(소문자 m)를 먼저 갈라내므로, 소문자 `m7`은 이 표에
 * 절대 넣지 않는다(그건 실제 minor7 quality이며 별칭이 아니다).
 *
 * ── 정규화 규칙 ──
 * 괄호형 키(`7(9)` 등)는 소문자 접미사 + 원형 괄호를 그대로 보존한다(단, 대문자 M은 예외).
 * `♭`↔`b`·`♯`↔`#` 등가는 소비 측(normalize)에서 흡수하므로 여기서는 `b`/`#`로 authored한다.
 */
export const QUALITY_ALIASES: Record<string, Quality> = {
  // ── maj7 계열 (대문자 M / Δ 보존) ──
  M7: 'maj7',
  Δ: 'maj7',
  Δ7: 'maj7',
  ma7: 'maj7',
  major7: 'maj7',

  // ── 트라이어드 풀네임 표기 (maj/min/major/minor) ──
  maj: 'maj',
  major: 'maj',
  min: 'min',
  minor: 'min',

  // ── add2 = add9 (2도 = 9도, 동일 PC set) ──
  add2: 'add9',
  add9: 'add9',

  // ── 도미넌트/괄호형 텐션 ──
  '7(9)': '9',
  '7(b9)': '7b9',
  '7(#9)': '7#9',
  '7(11)': '11',
  '7(13)': '13',

  // ── 마이너 괄호형 텐션 ──
  'm7(9)': 'm9',
  'm7(11)': 'm11',
  'm7(b5)': 'm7b5',

  // ── 메이저7 괄호형 텐션 ──
  'maj7(9)': 'maj9',
  'maj7(11)': 'maj11',
  'maj7(#11)': 'maj#11',
};
