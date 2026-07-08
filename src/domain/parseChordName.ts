import type { Quality, RootIndex } from './types';
import { SUF } from './constants';
import { QUALITY_ALIASES } from './aliases';
import { normalizeChordText } from './normalize';

export interface ParsedChord {
  root: RootIndex;
  qualKey: Quality;
  bass?: RootIndex; // PR-B에서 활성 (슬래시). PR-A에서는 슬래시 입력을 null 처리.
  display: string; // 원본 자연 표기 (표시용) — 예 'AM7', 'Am7'
}

// ── 루트 음이름 → RootIndex (샤프 표기 기준, 이명동음 흡수) ──
const LETTER_PC: Record<string, number> = {
  c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11,
};

/**
 * 접미사(정규형) → Quality 조회표.
 * 정규 SUF 값 + 별칭 테이블을 모두 정규화(normalizeChordText)하여 접는다.
 * 별칭이 정규 SUF를 덮어쓰지 않도록 SUF 먼저, 별칭 나중에 채운다(별칭은 추가 경로).
 */
const SUFFIX_INDEX: Record<string, Quality> = buildSuffixIndex();

function buildSuffixIndex(): Record<string, Quality> {
  const idx: Record<string, Quality> = {};
  // 1) 정규 SUF 값 (예: SUF['m7']='m7', SUF['maj7']='maj7', SUF['7b9']='7♭9')
  //    canonical suffix가 진실. 정규화하여 키로.
  for (const q of Object.keys(SUF) as Quality[]) {
    const norm = normalizeChordText(SUF[q]);
    // 빈 접미사(maj)는 별도 처리(빈 suf → maj), 인덱스에 넣지 않음.
    if (norm === '') continue;
    if (!(norm in idx)) idx[norm] = q;
  }
  // 2) 별칭 (추가 경로 — 이미 있는 키는 SUF 우선)
  for (const [alias, q] of Object.entries(QUALITY_ALIASES)) {
    const norm = normalizeChordText(alias);
    if (!(norm in idx)) idx[norm] = q;
  }
  return idx;
}

/** 루트 문자열 (음이름 + 선택적 변화표) → RootIndex, 실패 시 null. */
function parseRoot(letter: string, accidental: string): RootIndex | null {
  const base = LETTER_PC[letter.toLowerCase()];
  if (base === undefined) return null;
  let pc = base;
  if (accidental === '#' || accidental === '♯') pc += 1;
  else if (accidental === 'b' || accidental === '♭') pc -= 1;
  return (((pc % 12) + 12) % 12) as RootIndex;
}

/**
 * 접미사를 Quality로 해석 (케이스 민감).
 *
 * 케이스 민감 규칙 (§2.3):
 *  - 빈 접미사 → 'maj' (메이저 트라이어드)
 *  - 접미사가 소문자 'm'으로 시작(그 뒤가 'aj'가 아님) → minor 계열
 *  - 접미사가 대문자 'M'으로 시작(그 뒤가 'aj'가 아님) → maj7 계열 (M7→maj7)
 *      · 단독 대문자 'M' (뒤에 아무것도 없음) → 'maj' 트라이어드 (코디네이터 결정)
 *  - 그 외는 정규화 후 SUFFIX_INDEX 조회
 */
function resolveQuality(suf: string): Quality | null {
  if (suf === '') return 'maj';

  const first = suf[0];
  const rest = suf.slice(1);

  // 대문자 M 계열 (Maj/maj가 아닌 순수 M) — maj7 shorthand
  if (first === 'M' && !rest.toLowerCase().startsWith('aj')) {
    if (rest === '') return 'maj'; // 단독 'M' → major triad
    // 'M' → 'maj' 로 치환 후 정규 인덱스 조회 (M7 → maj7, M9 → maj9 …)
    const rewritten = normalizeChordText('maj' + rest);
    return SUFFIX_INDEX[rewritten] ?? null;
  }

  // 소문자 m 계열 (maj가 아닌 순수 minor) — 단독 'm' → minor triad
  if (first === 'm' && !rest.toLowerCase().startsWith('aj')) {
    if (rest === '') return 'min';
    // 정규 인덱스 조회 (m7, m6, m9, m11 …) — 소문자 그대로가 canonical
    const norm = normalizeChordText(suf);
    return SUFFIX_INDEX[norm] ?? null;
  }

  // 그 외 (maj*, 숫자 시작, sus, add, dim, aug, 괄호형 …)
  const norm = normalizeChordText(suf);
  return SUFFIX_INDEX[norm] ?? null;
}

/**
 * 코드명 문자열 → {root, qualKey, display} | null (케이스 민감 파서).
 *
 * PR-A: 슬래시(`/`) 포함 입력은 **null 반환**(PR-B에서 베이스 처리). 잘못된 결과보다 미지원이 명확.
 */
export function parseChordName(input: string): ParsedChord | null {
  const display = input.trim();
  if (display === '') return null;
  // 슬래시 포함 → PR-A 미지원 (PR-B에서 처리)
  if (display.includes('/')) return null;

  const m = /^([A-Ga-g])([#b♯♭]?)/.exec(display);
  if (!m) return null;
  const root = parseRoot(m[1], m[2]);
  if (root === null) return null;

  const suf = display.slice(m[0].length);
  const qualKey = resolveQuality(suf);
  if (qualKey === null) return null;

  return { root, qualKey, display };
}
