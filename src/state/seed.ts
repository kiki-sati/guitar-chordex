import { buildChord } from '../domain/chord';
import { dateStr } from '../domain/notes';
import { NOTE } from '../domain/constants';
import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
  Note,
  Quality,
} from '../domain/types';

/** 결정론적 시드 잔디 (원본 라인 263-268). today 기준 150일 + 최근 7일 덮어쓰기. */
export function seedGrass(today: Date = new Date()): GrassMap {
  const g: GrassMap = {};
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  for (let i = 0; i < 150; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    const v = Math.abs((i * 2654435761) % 97);
    let c = 0;
    if (v < 24) c = 0;
    else if (v < 50) c = 1;
    else if (v < 72) c = 2;
    else if (v < 89) c = 3;
    else c = 4;
    if (c > 0) g[dateStr(d)] = c;
  }
  [2, 2, 1, 3, 1, 2, 1].forEach((c, i) => {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    g[dateStr(d)] = c;
  });
  return g;
}

/** 시드 일지 (원본 라인 276-280, KO). */
export function seedJournal(today: Date = new Date()): JournalEntry[] {
  const ds = (o: number): string => {
    const d = new Date(today);
    d.setDate(today.getDate() - o);
    return dateStr(d);
  };
  return [
    {
      id: 's1',
      date: ds(0),
      title: 'F 바레코드 집중',
      minutes: 35,
      chords: ['F', 'C', 'G', 'Am'],
      notes:
        'F 바레가 깨끗하게 안 눌려서 1번 줄 위주로 천천히 연습. 검지 측면으로 누르니 좀 나아짐.',
    },
    {
      id: 's2',
      date: ds(2),
      title: '캐논 코드 진행',
      minutes: 50,
      chords: ['C', 'G', 'Am', 'Em', 'F'],
      notes: 'I-V-vi-iii-IV 진행 메트로놈 80bpm. 코드 전환 매끄러워지는 중.',
    },
    {
      id: 's3',
      date: ds(5),
      title: '펜타토닉 스케일 워밍업',
      minutes: 20,
      chords: ['Am7', 'Dm7'],
      notes: 'A 마이너 펜타토닉 5포지션. 손가락 풀기용.',
    },
  ];
}

/** 시드 드릴 (원본 라인 246-251, KO). */
export function seedDrills(): Drill[] {
  return [
    { id: 'd1', title: 'F 바레코드 깨끗하게 누르기', target: 10, count: 6 },
    { id: 'd2', title: '캐논 진행 C–G–Am–Em–F 전환', target: 8, count: 3 },
    { id: 'd3', title: '크로매틱 워밍업 (1-2-3-4)', target: 5, count: 5 },
    { id: 'd4', title: 'A 마이너 펜타토닉 5포지션', target: 5, count: 0 },
  ];
}

/** 시드 담은 코드 (원본 라인 232). */
export function seedCollected(): CollectedChord[] {
  const defs: ReadonlyArray<readonly [Note, Quality]> = [
    ['C', 'maj'],
    ['G', 'maj'],
    ['A', 'min'],
    ['F', 'maj'],
  ];
  return defs.map(([r, q]) => {
    const ch = buildChord(NOTE.indexOf(r), q);
    return { name: ch.name, frets: ch.frets, key: ch.name };
  });
}
