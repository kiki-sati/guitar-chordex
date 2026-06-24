import { OPEN_MIDI } from './constants';
import { chordPCs, requiredPCs } from './chord';
import type {
  FretArray,
  PitchClass,
  Quality,
  RootIndex,
  VoicingCandidate,
} from './types';

// 모듈 스코프 메모 캐시 (원본 this._vc). 입력→출력 결정론적이므로 순수성 유지.
const bestCache = new Map<string, FretArray>();
const allCache = new Map<string, FretArray[]>();

/** 테스트용 캐시 초기화. */
export function __clearVoicingCache(): void {
  bestCache.clear();
  allCache.clear();
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

/**
 * 포지션별 최선 1개씩, 최대 10폼. (원본 라인 340-345)
 */
export function allVoicings(root: RootIndex, qual: Quality): FretArray[] {
  const ck = 'a' + root + '|' + qual;
  const cached = allCache.get(ck);
  if (cached) return cached;
  const full = chordPCs(root, qual);
  const req = requiredPCs(root, qual);
  const rootPc = root % 12;
  const byPos: Record<number, VoicingCandidate> = {};
  for (let base = 0; base <= 11; base++) {
    const vs = enumBase(base, full, req, rootPc);
    for (const v of vs) {
      const k = v.pos;
      if (!byPos[k] || v.score < byPos[k].score) byPos[k] = v;
    }
  }
  const list = Object.values(byPos)
    .sort((a, b) => a.pos - b.pos || a.score - b.score)
    .slice(0, 10)
    .map((v) => v.frets);
  allCache.set(ck, list);
  return list;
}
