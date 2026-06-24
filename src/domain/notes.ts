import { NOTE } from './constants';
import type { Note } from './types';

/** NOTE[((i%12)+12)%12] — 음수/12이상도 안전하게 래핑. (원본 라인 289) */
export function noteName(i: number): Note {
  return NOTE[((i % 12) + 12) % 12];
}

/** 'YYYY-MM-DD' (월/일 padStart 2). (원본 라인 290) */
export function dateStr(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/** 검색 정규화: toLowerCase + ♭→b + ♯→#. (원본 chordGrid 라인 560) */
export function normalizeQuery(s: string): string {
  return s.toLowerCase().replace(/♭/g, 'b').replace(/♯/g, '#');
}
