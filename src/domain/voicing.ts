import { OPEN_MIDI } from './constants';
import { chordPCs, requiredPCs } from './chord';
import { CAGED_SHAPES, ROOT_STRING_SHAPE, transposeShape } from './voicing-shapes';
import type {
  FretArray,
  PitchClass,
  Quality,
  RootIndex,
  VoicingCandidate,
  VoicingForm,
  VoicingPosition,
} from './types';

// ── 다형 노출 튜닝 상수 (오케스트레이터 확정 — 계획서 §5 권장에서 상향) ──
/** 포지션당 최대 폼 수. 사용자 "그 자리서 잡을 수 있는 폼 다 보여줘" 반영(권장 2→3). */
export const MAX_FORMS_PER_POS = 3;
/** 전체 폼 상한. 화면 스크롤 감내 범위(권장 12→16). */
export const MAX_TOTAL_FORMS = 16;
/** 이 포지션 이상에서 개방현(0)을 섞는 폼은 비실전으로 배제(계획서 §5.4). */
const OPEN_MIX_CUTOFF_POS = 5;
/** 템플릿 트랜스포즈 +12 옥타브가 넘어서면 안 되는 실전 최대 프렛(계획서 §3.3.1). */
const MAX_TEMPLATE_FRET = 14;

// 모듈 스코프 메모 캐시 (원본 this._vc). 입력→출력 결정론적이므로 순수성 유지.
const bestCache = new Map<string, FretArray>();
const allCache = new Map<string, FretArray[]>();
const posCache = new Map<string, VoicingPosition[]>();

/** 테스트용 캐시 초기화. */
export function __clearVoicingCache(): void {
  bestCache.clear();
  allCache.clear();
  posCache.clear();
}

/**
 * base 프렛에서 가능한 모든 운지 조합을 enum → _collect로 평가. (원본 라인 315-321)
 */
function enumBase(
  base: number,
  full: Set<PitchClass>,
  req: Set<PitchClass>,
  rootPc: number,
): VoicingCandidate[] {
  const OPEN = OPEN_MIDI;
  const cand: FretArray[] = [];
  for (let s = 0; s < 6; s++) {
    const opts: FretArray = ['x'];
    const fl = new Set<number>();
    if (base > 0) fl.add(0);
    for (let f = Math.max(0, base); f < base + 4; f++) fl.add(f);
    fl.forEach((f) => {
      if (full.has((OPEN[s] + f) % 12)) opts.push(f);
    });
    cand.push(opts);
  }
  const out: VoicingCandidate[] = [];
  const cur: FretArray = new Array(6).fill('x');
  const rec = (s: number): void => {
    if (s === 6) {
      collect(cur, req, rootPc, OPEN, out);
      return;
    }
    const o = cand[s];
    for (let i = 0; i < o.length; i++) {
      cur[s] = o[i];
      rec(s + 1);
    }
  };
  rec(0);
  return out;
}

/**
 * 후보 필터 + 스코어링. (원본 라인 322-333)
 *  - 비뮤트 현 < 4 → reject
 *  - first~last 사이 'x' → reject (연속 보이싱만)
 *  - 운지폭 4프렛 초과 → reject
 *  - req 음 누락 → reject
 *  - score: bassPc!==rootPc → +4, +(6-cnt), mx>0 → +(mx-mn)*0.3
 */
function collect(
  frets: FretArray,
  req: Set<PitchClass>,
  rootPc: number,
  OPEN: readonly number[],
  out: VoicingCandidate[],
): void {
  let first = -1;
  let last = -1;
  let cnt = 0;
  for (let s = 0; s < 6; s++) {
    if (frets[s] !== 'x') {
      if (first < 0) first = s;
      last = s;
      cnt++;
    }
  }
  if (cnt < 4) return;
  for (let s = first; s <= last; s++) {
    if (frets[s] === 'x') return;
  }
  let mn = 99;
  let mx = 0;
  for (let s = first; s <= last; s++) {
    const f = frets[s] as number;
    if (f > 0) {
      if (f < mn) mn = f;
      if (f > mx) mx = f;
    }
  }
  if (mx > 0 && mx - mn > 4) return;
  const pcs = new Set<PitchClass>();
  for (let s = first; s <= last; s++) {
    pcs.add((OPEN[s] + (frets[s] as number)) % 12);
  }
  for (const r of req) {
    if (!pcs.has(r)) return;
  }
  const bassPc = (OPEN[first] + (frets[first] as number)) % 12;
  const pos = mx > 0 ? mn : 0;
  let score = 0;
  if (bassPc !== rootPc) score += 4;
  score += 6 - cnt;
  if (mx > 0) score += (mx - mn) * 0.3;
  out.push({ frets: frets.slice(), pos, score });
}

/**
 * 최선 보이싱 1개. 가장 낮은 base에서 후보가 나오면 즉시 중단. (원본 라인 334-339)
 */
export function bestVoicing(root: RootIndex, qual: Quality): FretArray {
  const ck = 'b' + root + '|' + qual;
  const cached = bestCache.get(ck);
  if (cached) return cached;
  const full = chordPCs(root, qual);
  const req = requiredPCs(root, qual);
  const rootPc = root % 12;
  let best: VoicingCandidate | null = null;
  for (let base = 0; base <= 10; base++) {
    const vs = enumBase(base, full, req, rootPc);
    for (const v of vs) {
      if (!best || v.score < best.score) best = v;
    }
    if (best) break;
  }
  const frets: FretArray = best ? best.frets : ['x', 'x', 'x', 'x', 'x', 'x'];
  bestCache.set(ck, frets);
  return frets;
}

// ── voicingsByPosition 내부 헬퍼 (순수) ──

// 한 후보(내부): frets + 출처 + 쉐입 + pos + score.
interface FormCandidate {
  frets: FretArray;
  source: 'template' | 'enum';
  shape?: VoicingForm['shape'];
  pos: number;
  score: number;
}

function keyOf(frets: FretArray): string {
  return frets.join(',');
}
function hasOpenString(frets: FretArray): boolean {
  return frets.some((f) => f === 0);
}
function soundedCount(frets: FretArray): number {
  return frets.filter((f) => f !== 'x').length;
}
function bassPcOf(frets: FretArray): number {
  for (let s = 0; s < 6; s++) {
    if (frets[s] !== 'x') return (OPEN_MIDI[s] + (frets[s] as number)) % 12;
  }
  return -1;
}
function pcSetOf(frets: FretArray): Set<number> {
  const set = new Set<number>();
  frets.forEach((f, s) => {
    if (f !== 'x') set.add((OPEN_MIDI[s] + (f as number)) % 12);
  });
  return set;
}
// 결정론 tie-break: frets 사전순. 'x'는 -1로 취급(뮤트가 가장 앞).
function lexCompare(a: FretArray, b: FretArray): number {
  for (let i = 0; i < 6; i++) {
    const av = a[i] === 'x' ? -1 : (a[i] as number);
    const bv = b[i] === 'x' ? -1 : (b[i] as number);
    if (av !== bv) return av - bv;
  }
  return 0;
}
// 유사 폼 판정(2차 dedup): 동일 pcs 집합 + 프렛 요소별 차이 합 <= 1.
function isNearDuplicate(a: FretArray, b: FretArray): boolean {
  const pa = [...pcSetOf(a)].sort((x, y) => x - y).join(',');
  const pb = [...pcSetOf(b)].sort((x, y) => x - y).join(',');
  if (pa !== pb) return false;
  let diff = 0;
  for (let i = 0; i < 6; i++) {
    const av = a[i] === 'x' ? -1 : (a[i] as number);
    const bv = b[i] === 'x' ? -1 : (b[i] as number);
    diff += Math.abs(av - bv);
  }
  return diff <= 1;
}

/**
 * 포지션별 다형 보이싱. 표준(CAGED) 폼 우선 + enum 보강.
 *
 * 파이프라인: 템플릿 트랜스포즈 → collect 필터 → enum 병합 → 완전중복 dedup
 * (template 우선) → pos>=5 개방혼합 큐레이션 → 포지션 그룹핑 → 포지션 내 정렬
 * + 유사폼 dedup + slice N → 전체 slice M.
 *
 * - 결정론적(입력 동일 → 출력 동일). 모듈 캐시 사용.
 * - 각 폼은 collect 필터 통과(≥4현·연속·스팬≤4·req 포함).
 * - bestVoicing/enumBase/collect 무변경(블라스트 반경 최소).
 */
export function voicingsByPosition(
  root: RootIndex,
  qual: Quality,
): VoicingPosition[] {
  const ck = 'p' + root + '|' + qual;
  const cached = posCache.get(ck);
  if (cached) return cached;

  const full = chordPCs(root, qual);
  const req = requiredPCs(root, qual);
  const rootPc = root % 12;

  const candidates: FormCandidate[] = [];

  // 1) 템플릿(CAGED) 폼 — 1급 소스. 각 폼도 collect 필터 통과 강제.
  const shapes = CAGED_SHAPES[qual] ?? [];
  for (const sh of shapes) {
    for (const fr of transposeShape(sh, root)) {
      // +12 옥타브가 실전 상한을 넘으면 컷오프.
      let maxFret = 0;
      for (const f of fr) if (f !== 'x' && (f as number) > maxFret) maxFret = f as number;
      if (maxFret > MAX_TEMPLATE_FRET) continue;
      const out: VoicingCandidate[] = [];
      collect(fr, req, rootPc, OPEN_MIDI, out);
      if (out.length) {
        const v = out[0];
        candidates.push({
          frets: v.frets,
          source: 'template',
          shape: ROOT_STRING_SHAPE[sh.rootString],
          pos: v.pos,
          score: v.score,
        });
      }
    }
  }

  // 2) enum 보강 — 기존 알고리즘 그대로(바이트 불변).
  for (let base = 0; base <= 11; base++) {
    for (const v of enumBase(base, full, req, rootPc)) {
      candidates.push({
        frets: v.frets,
        source: 'enum',
        pos: v.pos,
        score: v.score,
      });
    }
  }

  // 3) 완전중복 dedup — template 태그 우선 보존.
  const byKey = new Map<string, FormCandidate>();
  for (const c of candidates) {
    const k = keyOf(c.frets);
    const ex = byKey.get(k);
    if (!ex) {
      byKey.set(k, c);
    } else if (ex.source === 'enum' && c.source === 'template') {
      byKey.set(k, c);
    }
  }

  // 4) 큐레이션 — pos>=5 개방혼합 배제(비실전).
  const curated = [...byKey.values()].filter(
    (c) => !(c.pos >= OPEN_MIX_CUTOFF_POS && hasOpenString(c.frets)),
  );

  // 5) 포지션 그룹핑.
  const groups = new Map<number, FormCandidate[]>();
  for (const c of curated) {
    const g = groups.get(c.pos);
    if (g) g.push(c);
    else groups.set(c.pos, [c]);
  }

  // 6) 포지션 내 정렬 + 유사폼 dedup + slice N.
  const positions: VoicingPosition[] = [];
  const posKeys = [...groups.keys()].sort((a, b) => a - b);
  for (const pos of posKeys) {
    const arr = groups.get(pos)!;
    arr.sort((a, b) => {
      // 1) template 먼저.
      const ta = a.source === 'template' ? 0 : 1;
      const tb = b.source === 'template' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      // 2) 루트베이스 먼저.
      const ra = bassPcOf(a.frets) === rootPc ? 0 : 1;
      const rb = bassPcOf(b.frets) === rootPc ? 0 : 1;
      if (ra !== rb) return ra - rb;
      // 3) 풀보이싱 먼저(비뮤트 현 많은 순).
      const ca = soundedCount(a.frets);
      const cb = soundedCount(b.frets);
      if (ca !== cb) return cb - ca;
      // 4) 개방혼합 후순위.
      const oa = hasOpenString(a.frets) ? 1 : 0;
      const ob = hasOpenString(b.frets) ? 1 : 0;
      if (oa !== ob) return oa - ob;
      // 5) 최종 tie-break: frets 사전순(결정론 — D2).
      return lexCompare(a.frets, b.frets);
    });
    const kept: FormCandidate[] = [];
    for (const c of arr) {
      if (kept.some((k) => isNearDuplicate(c.frets, k.frets))) continue;
      kept.push(c);
      if (kept.length >= MAX_FORMS_PER_POS) break;
    }
    positions.push({
      pos,
      forms: kept.map((c) => ({
        frets: c.frets,
        source: c.source,
        ...(c.shape ? { shape: c.shape } : {}),
      })),
    });
  }

  // 7) 전체 상한 M(폼 수 기준) — pos 오름차순으로 채운다.
  const result: VoicingPosition[] = [];
  let total = 0;
  for (const p of positions) {
    if (total >= MAX_TOTAL_FORMS) break;
    const room = MAX_TOTAL_FORMS - total;
    const forms = p.forms.slice(0, room);
    if (!forms.length) continue;
    result.push({ pos: p.pos, forms });
    total += forms.length;
  }

  posCache.set(ck, result);
  return result;
}

/**
 * @deprecated 포지션 그룹은 voicingsByPosition 사용. 평면 리스트 필요 시에만.
 *
 * voicingsByPosition의 폼을 평탄화한 호환 어댑터(레거시 소비자용).
 * 반환은 다형 노출로 기존과 달라질 수 있음(표준 폼 포함·비실전 배제).
 */
export function allVoicings(root: RootIndex, qual: Quality): FretArray[] {
  const ck = 'a' + root + '|' + qual;
  const cached = allCache.get(ck);
  if (cached) return cached;
  const list = voicingsByPosition(root, qual).flatMap((p) =>
    p.forms.map((f) => f.frets),
  );
  allCache.set(ck, list);
  return list;
}
