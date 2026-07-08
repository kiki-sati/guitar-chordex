import { OPEN_MIDI, SUF } from './constants';
import { chordPCs, requiredPCs, buildChord } from './chord';
import { allVoicings, bestVoicing } from './voicing';
import { noteName } from './notes';
import type { Chord, FretArray, PitchClass, Quality, RootIndex } from './types';

/**
 * 슬래시(온코드/전위) 보이싱 — voicing.ts 무변경 신규 계층 (설계 §4).
 *
 * 정의: 슬래시 `X/Y` 보이싱 = **최저 발음현의 PC === bass PC**.
 * (최저 발음현 = frets에서 'x'가 아닌 가장 낮은 인덱스의 현. 그 현의 음 = (OPEN_MIDI[s]+fret)%12.)
 *
 * 경로 분기 (isInversion):
 *  - 전위(bass ∈ chordPCs): 기존 allVoicings 후보 중 최저현=bass 우선 채택 → 없으면 온코드 알고리즘 재탐색.
 *  - 온코드(bass ∉ chordPCs): 최저현=bass 고정, 나머지 현은 (chordPCs ∪ {bass}) 허용, 필수음=requiredPCs∪{bass}.
 *
 * 연주 가능성 필터(기존 collect와 동일): 비뮤트 ≥4, 발음현 사이 연속(뮤트 없음), 스팬 ≤4, 필수음 포함.
 * 폴백: bass 제약 후보 0건이면 bestVoicing(root,qual) 반환(name은 슬래시 유지).
 */

// ── 다형 노출 상수 (voicing.ts 감각과 정합) ──
const MAX_FORMS_PER_POS = 3;
const MAX_TOTAL_FORMS = 16;

// ── 결정론 캐시 ──
const bestSlashCache = new Map<string, FretArray>();
const allSlashCache = new Map<string, FretArray[]>();

/** 테스트용 캐시 초기화. */
export function __clearSlashCache(): void {
  bestSlashCache.clear();
  allSlashCache.clear();
}

/** bass가 코드톤이면 true(전위) — 경로 분기 판정. */
export function isInversion(
  root: RootIndex,
  qual: Quality,
  bass: RootIndex,
): boolean {
  return chordPCs(root, qual).has(bass % 12);
}

// ── 보이싱 검사 유틸 (collect 규칙과 1:1) ──
function lowestSounded(fr: FretArray): number {
  for (let s = 0; s < 6; s++) if (fr[s] !== 'x') return s;
  return -1;
}
function bassPcOf(fr: FretArray): number {
  const s = lowestSounded(fr);
  return s < 0 ? -1 : (OPEN_MIDI[s] + (fr[s] as number)) % 12;
}

interface SlashCandidate {
  frets: FretArray;
  pos: number; // 다이어그램 시작 프렛 기준 (mx>0 ? mn : 0)
  score: number; // 낮을수록 우수
}

/**
 * 후보 필터 + 스코어 (collect §322-333 규칙 이식 + bass 고정 검사).
 *  - 비뮤트 <4 → reject
 *  - first~last 사이 'x' → reject (연속)
 *  - 스팬 4 초과 → reject
 *  - 최저 발음현 PC !== bass → reject (슬래시 정의)
 *  - req(필수음) 누락 → reject
 * score: +(6-cnt) 풀보이싱 선호, mx>0 → +(mx-mn)*0.3 (낮은 포지션·꽉 찬 폼 선호).
 */
function collectSlash(
  frets: FretArray,
  req: Set<PitchClass>,
  bass: number,
  out: SlashCandidate[],
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
  for (let s = first; s <= last; s++) if (frets[s] === 'x') return;
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
  // 최저 발음현 PC === bass (슬래시 정의)
  const bp = (OPEN_MIDI[first] + (frets[first] as number)) % 12;
  if (bp !== bass) return;
  const pcs = new Set<PitchClass>();
  for (let s = first; s <= last; s++) {
    pcs.add((OPEN_MIDI[s] + (frets[s] as number)) % 12);
  }
  for (const r of req) if (!pcs.has(r)) return;
  const pos = mx > 0 ? mn : 0;
  let score = 0;
  score += 6 - cnt;
  if (mx > 0) score += (mx - mn) * 0.3;
  out.push({ frets: frets.slice(), pos, score });
}

/**
 * base 프렛에서 최저현=bass 고정, 나머지 현은 full(허용 PC) 배치하여 후보 열거.
 * (enumBase §315-321 구조 이식 + 최저현 옵션을 bass PC로만 제한.)
 */
function enumSlashBase(
  base: number,
  full: Set<PitchClass>,
  req: Set<PitchClass>,
  bass: number,
  out: SlashCandidate[],
): void {
  const OPEN = OPEN_MIDI;
  // 각 현의 후보 프렛 목록: 개방(0, base>0일 때) + [base, base+4).
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
  const cur: FretArray = new Array(6).fill('x');
  const rec = (s: number): void => {
    if (s === 6) {
      collectSlash(cur, req, bass, out);
      return;
    }
    const o = cand[s];
    for (let i = 0; i < o.length; i++) {
      cur[s] = o[i];
      rec(s + 1);
    }
  };
  rec(0);
}

/** 온코드/재탐색 후보 생성: full=chordPCs∪{bass}, req=requiredPCs∪{bass}. */
function generateSlashCandidates(
  root: RootIndex,
  qual: Quality,
  bass: RootIndex,
): SlashCandidate[] {
  const bp = bass % 12;
  const full = new Set(chordPCs(root, qual));
  full.add(bp);
  const req = new Set(requiredPCs(root, qual));
  req.add(bp);
  const out: SlashCandidate[] = [];
  for (let base = 0; base <= 11; base++) {
    enumSlashBase(base, full, req, bp, out);
  }
  return out;
}

// 결정론 tie-break: frets 사전순('x'=-1).
function lexCompare(a: FretArray, b: FretArray): number {
  for (let i = 0; i < 6; i++) {
    const av = a[i] === 'x' ? -1 : (a[i] as number);
    const bv = b[i] === 'x' ? -1 : (b[i] as number);
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** 후보 정렬(우수 순): score↑ → pos↑ → 사전순. 결정론. */
function sortCandidates(cands: SlashCandidate[]): SlashCandidate[] {
  return cands.slice().sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.pos !== b.pos) return a.pos - b.pos;
    return lexCompare(a.frets, b.frets);
  });
}

/**
 * 슬래시 보이싱 후보 목록(정렬·중복제거·포지션별 상한). bass 제약 충족만.
 * 전위: allVoicings 중 최저현=bass 우선 + 온코드 알고리즘 보강.
 * 온코드: 온코드 알고리즘 전용.
 */
function slashCandidates(
  root: RootIndex,
  qual: Quality,
  bass: RootIndex,
): SlashCandidate[] {
  const bp = bass % 12;
  const req = new Set(requiredPCs(root, qual)); // 상부 필수음
  req.add(bp);
  const out: SlashCandidate[] = [];

  if (isInversion(root, qual, bass)) {
    // 전위: 기존 보이싱 후보 중 최저현=bass 인 폼을 우선 채택(스코어 무관).
    for (const fr of allVoicings(root, qual)) {
      if (bassPcOf(fr) === bp) collectSlash(fr, req, bp, out);
    }
  }
  // 온코드 또는 전위 보강(전위에서 위 채택이 부족할 수 있어 항상 보강 열거).
  for (const c of generateSlashCandidates(root, qual, bass)) out.push(c);

  // 완전중복 dedup + 정렬 + 포지션별 상한.
  const byKey = new Map<string, SlashCandidate>();
  for (const c of out) {
    const k = c.frets.join(',');
    const ex = byKey.get(k);
    if (!ex || c.score < ex.score) byKey.set(k, c);
  }
  const sorted = sortCandidates([...byKey.values()]);

  // 포지션별 상한 + 전체 상한.
  const perPos = new Map<number, number>();
  const kept: SlashCandidate[] = [];
  for (const c of sorted) {
    const n = perPos.get(c.pos) ?? 0;
    if (n >= MAX_FORMS_PER_POS) continue;
    perPos.set(c.pos, n + 1);
    kept.push(c);
    if (kept.length >= MAX_TOTAL_FORMS) break;
  }
  return kept;
}

/** 포지션별 베이스 제약 보이싱(결정론, 최대 N). 후보 0건이면 빈 배열. */
export function allSlashVoicings(
  root: RootIndex,
  qual: Quality,
  bass: RootIndex,
): FretArray[] {
  const ck = root + '|' + qual + '|' + (bass % 12);
  const cached = allSlashCache.get(ck);
  if (cached) return cached;
  const list = slashCandidates(root, qual, bass).map((c) => c.frets);
  allSlashCache.set(ck, list);
  return list;
}

/**
 * 베이스 제약 보이싱 1개(최선). 최저 발음현 PC === bass.
 * 후보 0건이면 폴백: bestVoicing(root,qual) (슬래시 없이라도 코드는 나오게).
 */
export function bestSlashVoicing(
  root: RootIndex,
  qual: Quality,
  bass: RootIndex,
): FretArray {
  const ck = root + '|' + qual + '|' + (bass % 12);
  const cached = bestSlashCache.get(ck);
  if (cached) return cached;
  const forms = allSlashVoicings(root, qual, bass);
  const frets = forms.length ? forms[0] : bestVoicing(root, qual);
  bestSlashCache.set(ck, frets);
  return frets;
}

/**
 * 슬래시 코드 빌드. name='body/bass'. bass===root면 슬래시 무의미 → 일반 buildChord.
 * body = noteName(root)+SUF[qual]. frets = bestSlashVoicing(...).
 */
export function buildSlashChord(
  root: RootIndex,
  qual: Quality,
  bass: RootIndex,
): Chord {
  if (bass % 12 === root % 12) return buildChord(root, qual);
  const body = noteName(root) + (SUF[qual] || '');
  const name = body + '/' + noteName(bass);
  const frets = bestSlashVoicing(root, qual, bass);
  return { name, frets, root, qualKey: qual, bass, key: name };
}
