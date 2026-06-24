import { buildChord } from './chord';
import type { Chord, KeyType, Quality, RootIndex } from './types';

/** 다이어토닉 7코드 (로마숫자 포함). (원본 라인 383-389) */
export function diatonic(rootIdx: RootIndex, type: KeyType): Chord[] {
  const majSteps = [0, 2, 4, 5, 7, 9, 11];
  const minSteps = [0, 2, 3, 5, 7, 8, 10];
  const majQ: Quality[] = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
  const majR = ['Imaj7', 'ii m7', 'iii m7', 'IV maj7', 'V7', 'vi m7', 'viiø'];
  const minQ: Quality[] = ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'];
  const minR = ['i m7', 'iiø', '♭III maj7', 'iv m7', 'v m7', '♭VI maj7', '♭VII7'];
  const steps = type === 'major' ? majSteps : minSteps;
  const quals = type === 'major' ? majQ : minQ;
  const romans = type === 'major' ? majR : minR;
  return steps.map((st, i) => {
    const ni = (rootIdx + st) % 12;
    const ch = buildChord(ni, quals[i]);
    return Object.assign(ch, { roman: romans[i], key: 'd' + i });
  });
}
