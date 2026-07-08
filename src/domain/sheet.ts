import { BEATS } from './constants';
import type { Sheet, SheetSequence, SheetSlot, TimeSig } from './types';

/**
 * 악보 빌더 순수 도메인 함수 (React 무의존, 테스트 1급).
 *
 * 디자인 SoT `기타 코드 연습 Figma.dc.html`의 헬퍼(라인 457-468, 607-608, 624)를
 * 수치/알고리즘 그대로 이식하되, **불변(입력 seq를 mutate 하지 않고 새 배열 반환)** 으로 재작성.
 * PR-1(로컬 전용) 범위. 오디오(strumSeq)는 후속.
 */

/** 박자표 → 박(beat) 수. 원본 beatsOf (라인 457). */
export function beatsOf(ts: TimeSig): number {
  return BEATS[ts];
}

/**
 * 슬롯 패딩. 원본 padSlots (라인 458).
 *   - 길이가 beats 배수가 되도록 null 채움.
 *   - 빈 배열이면 beats*2 길이(2마디)로 채움.
 * 불변: 입력을 복사 후 반환.
 */
export function padSlots(seq: SheetSequence, beats: number): SheetSequence {
  const out = seq.slice();
  while (out.length % beats !== 0) out.push(null);
  if (out.length === 0) {
    for (let i = 0; i < beats * 2; i++) out.push(null);
  }
  return out;
}

/**
 * 인덱스 i에 코드 배치(또는 null로 비우기). 원본 placeAt (라인 460).
 * 절대 인덱스 유지(sparse 배열 — filter로 인덱스 이동 금지).
 */
export function placeAt(
  seq: SheetSequence,
  i: number,
  chord: SheetSlot | null,
): SheetSequence {
  const out = seq.slice();
  out[i] = chord ? { name: chord.name, frets: chord.frets } : null;
  return out;
}

/** 인덱스 i 비우기. 원본 clearSlot (라인 461). */
export function clearSlot(seq: SheetSequence, i: number): SheetSequence {
  const out = seq.slice();
  out[i] = null;
  return out;
}

/** 마디 추가(beats개 null push). 원본 addMeasure (라인 462). */
export function addMeasure(seq: SheetSequence, beats: number): SheetSequence {
  const out = seq.slice();
  for (let i = 0; i < beats; i++) out.push(null);
  return out;
}

/**
 * 마디 삭제 후 재패딩. 원본 removeMeasure (라인 463).
 * mi번째 마디(beats칸) splice 후 padSlots(빈 배열이면 beats*2 복구).
 */
export function removeMeasure(
  seq: SheetSequence,
  mi: number,
  beats: number,
): SheetSequence {
  const out = seq.slice();
  out.splice(mi * beats, beats);
  return padSlots(out, beats);
}

/**
 * 박자표 변경의 순수부(setTimeSig, 원본 라인 464). timeSig 자체는 상태에서 교체하고
 * 시퀀스는 새 beats 기준으로 재패딩(기존 배치 코드 유지).
 */
export function retime(seq: SheetSequence, newBeats: number): SheetSequence {
  return padSlots(seq, newBeats);
}

/**
 * 렌더용 마디 분할. 원본 builderView 라인 607-608.
 * beats 단위로 자르고, 비면 최소 1개 빈 마디를 보장.
 */
export function sequenceToMeasures(
  seq: SheetSequence,
  beats: number,
): SheetSequence[] {
  const measures: SheetSequence[] = [];
  for (let i = 0; i < seq.length; i += beats) {
    measures.push(seq.slice(i, i + beats));
  }
  if (measures.length === 0) measures.push(new Array(beats).fill(null));
  return measures;
}

/** chordBox용 고유 코드(first-seen 순). 원본 라인 624 used. */
export function usedChords(seq: SheetSequence): SheetSlot[] {
  const seen = new Set<string>();
  const out: SheetSlot[] = [];
  for (const c of seq) {
    if (c && !seen.has(c.name)) {
      seen.add(c.name);
      out.push(c);
    }
  }
  return out;
}

/** 채워진(non-null) 박 수. 원본 sequence.filter(Boolean).length (라인 654 등). */
export function filledCount(seq: SheetSequence): number {
  return seq.filter(Boolean).length;
}

/** beats*2 빈 시퀀스(2마디). 원본 clearSeq (라인 467). */
export function emptySequence(beats: number): SheetSequence {
  return new Array(beats * 2).fill(null);
}

/**
 * 저장용 Sheet 생성. 원본 saveSheet의 sheet 객체(라인 468).
 * id='sh'+Date.now(), seq는 복사본. date는 호출자가 'YYYY-MM-DD'로 전달(reducer가 dateStr).
 */
export function makeSheet(
  title: string,
  seq: SheetSequence,
  timeSig: TimeSig,
  date: string,
): Sheet {
  return {
    id: 'sh' + Date.now(),
    title,
    seq: seq.slice(),
    timeSig,
    date,
  };
}
