import type { Quality, RootIndex } from './types';
import { QUALS, SUF, NOTE } from './constants';
import { QUALITY_ALIASES } from './aliases';
import { normalizeChordText } from './normalize';

export interface ChordSearchHit {
  root: RootIndex;
  qualKey: Quality;
  bass?: RootIndex; // PR-B(슬래시)에서 활성. PR-A에서는 항상 undefined.
}

// ── 루트별 이명동음 표기 (검색 관대성) ──
// 캐논 NOTE는 샤프 표기만 → 플랫 표기(Db/Eb/Gb/Ab/Bb)로도 검색되게 별칭 추가.
const FLAT_SPELLING: Record<number, string> = {
  1: 'Db', 3: 'Eb', 6: 'Gb', 8: 'Ab', 10: 'Bb',
};

/** RootIndex → 검색용 루트 표기 목록(정규형). 샤프(캐논) + 플랫 이명동음. */
function rootSpellings(r: RootIndex): string[] {
  const out = [normalizeChordText(NOTE[r])];
  const flat = FLAT_SPELLING[r];
  if (flat) out.push(normalizeChordText(flat));
  return out;
}

/** (root, qual)이 매칭되는 접미사 표기 목록(정규형). 캐논 SUF + 그 qual로 접히는 별칭들. */
function suffixForms(q: Quality): string[] {
  const forms = new Set<string>();
  forms.add(normalizeChordText(SUF[q])); // 캐논 (maj는 '' → 루트만)
  for (const [alias, target] of Object.entries(QUALITY_ALIASES)) {
    if (target === q) forms.add(normalizeChordText(alias));
  }
  return [...forms];
}

interface IndexEntry {
  text: string; // 정규형 검색 문자열 (루트표기 + 접미사표기)
  root: RootIndex;
  qual: Quality;
}

/** 12루트 × 58질 × (이명동음 루트 표기 × 접미사 표기) 전개 인덱스. */
const INDEX: IndexEntry[] = buildIndex();

function buildIndex(): IndexEntry[] {
  const entries: IndexEntry[] = [];
  for (let r = 0 as RootIndex; r < 12; r++) {
    const roots = rootSpellings(r);
    for (const q of QUALS) {
      const sufs = suffixForms(q);
      for (const rootStr of roots) {
        for (const sufStr of sufs) {
          entries.push({ text: rootStr + sufStr, root: r, qual: q });
        }
      }
    }
  }
  return entries;
}

/**
 * 코드 사전 검색 (도메인화 — 기존 DictionaryView 인라인 루프의 대체).
 *
 * - 정규형 부분일치(현 UX 유지): 정규화된 query가 인덱스 문자열의 부분열이면 히트.
 * - 별칭·괄호·`Δ`·`♭/♯`·케이스 흡수(normalizeChordText + 별칭 인덱싱).
 * - 이명동음 루트(`Bb`=`A#`) 양쪽 수용, 표시명은 소비 측에서 canonical 유지.
 * - 슬래시(`/`) 쿼리는 PR-A에서 미지원 → 히트 없음(PR-B에서 처리). 인덱스에 `/`가 없어 자연히 빈 결과.
 *
 * 반환 순서: root 오름차순 → QUALS 정의 순서. (root,qual) 중복 제거.
 */
export function searchChords(query: string): ChordSearchHit[] {
  const q = normalizeChordText(query.trim());
  if (q === '') return [];

  const seen = new Set<string>(); // `${root}|${qual}` 중복 제거
  const hits: ChordSearchHit[] = [];
  for (const e of INDEX) {
    if (!e.text.includes(q)) continue;
    const key = e.root + '|' + e.qual;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ root: e.root, qualKey: e.qual });
  }
  return hits;
}
