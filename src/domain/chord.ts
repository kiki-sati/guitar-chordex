import { OPEN, BARRE_OK, SUF, INTERVALS } from './constants';
import { noteName } from './notes';
import { bestVoicing } from './voicing';
import type {
  Chord,
  FretArray,
  PitchClass,
  Quality,
  RootIndex,
} from './types';

// E/A shape 테이블 (원본 라인 304-305)
const E_SHAPES: Record<string, FretArray> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  '7': [0, 2, 0, 1, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
};
const A_SHAPES: Record<string, FretArray> = {
  maj: ['x', 0, 2, 2, 2, 0],
  min: ['x', 0, 2, 2, 1, 0],
  '7': ['x', 0, 2, 0, 2, 0],
  maj7: ['x', 0, 2, 1, 2, 0],
  m7: ['x', 0, 2, 0, 1, 0],
  sus4: ['x', 0, 2, 2, 3, 0],
};

/**
 * 우선순위 (원본 라인 294-302):
 *  ① OPEN 맵 → ② m7b5 특수식 → ③ BARRE_OK 바레 → ④ bestVoicing 폴백
 */
export function buildChord(ni: RootIndex, qual: Quality): Chord {
  const name = noteName(ni) + (SUF[qual] || '');
  const key = noteName(ni) + '|' + qual;
  let frets: FretArray;
  if (OPEN[key]) {
    frets = OPEN[key].slice();
  } else if (qual === 'm7b5') {
    const n = ((ni - 9) + 12) % 12;
    frets = ['x', n, n + 1, n, n + 1, 'x'];
  } else if (BARRE_OK.has(qual)) {
    frets = barre(ni, qual);
  } else {
    frets = bestVoicing(ni, qual);
  }
  return { name, frets, root: ni, qualKey: qual, key: name };
}

/** E/A shape 선택 (원본 라인 303-311). */
export function barre(ni: RootIndex, qual: Quality): FretArray {
  const eBase = ((ni - 4) + 12) % 12;
  const aBase = ((ni - 9) + 12) % 12;
  let useA = false;
  let base = eBase;
  if (eBase === 0) {
    if (aBase > 0) {
      useA = true;
      base = aBase;
    }
  } else if (aBase > 0 && aBase < eBase) {
    useA = true;
    base = aBase;
  }
  const shape = useA ? A_SHAPES[qual] : E_SHAPES[qual];
  return shape.map((v) => (v === 'x' ? 'x' : base + v));
}

/** INTERVALS[qual]||[0,4,7] 의 (root+i)%12 집합. (원본 라인 313) */
export function chordPCs(root: RootIndex, qual: Quality): Set<PitchClass> {
  const iv = INTERVALS[qual] || [0, 4, 7];
  const set = new Set<PitchClass>();
  iv.forEach((i) => set.add((root + i) % 12));
  return set;
}

/**
 * 필수 구성음 (최대 4개). drop 순서 7(완전5도)→2(9도)→5(4도/11도). (원본 라인 314)
 */
export function requiredPCs(root: RootIndex, qual: Quality): Set<PitchClass> {
  let sem = [...new Set((INTERVALS[qual] || [0, 4, 7]).map((i) => i % 12))];
  const drop = [7, 2, 5];
  let i = 0;
  while (sem.length > 4 && i < drop.length) {
    sem = sem.filter((x) => x !== drop[i]);
    i++;
  }
  if (sem.length > 4) sem = sem.slice(0, 4);
  const set = new Set<PitchClass>();
  sem.forEach((s) => set.add((root + s) % 12));
  return set;
}
