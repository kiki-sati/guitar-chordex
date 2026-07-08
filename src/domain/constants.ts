import type {
  Note,
  Quality,
  Fret,
  ScaleType,
  ChordGroup,
  TimeSig,
} from './types';

// ── 12음 (원본 라인 172) ──
export const NOTE: readonly Note[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

// ── 코드명 접미사 (원본 라인 173) — 모든 Quality에 정의 강제 ──
export const SUF: Record<Quality, string> = {
  maj: '', min: 'm', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
  majb5: '(♭5)', 'm#5': 'm(♯5)', mbb5: 'm(♭♭5)', 'sus4#5': 'sus4(♯5)',
  sus2b5: 'sus2(♭5)', 'sus2#5': 'sus2(♯5)', '7': '7', m7: 'm7', maj7: 'maj7',
  mMaj7: 'mMaj7', dim7: 'dim7', aug7: '7(♯5)', augMaj7: 'maj7(♯5)',
  '7b5': '7(♭5)', maj7b5: 'maj7(♭5)', m7b5: 'm7♭5', mMaj7b5: 'mMaj7(♭5)',
  mMaj7bb5: 'mMaj7(♭♭5)', 'm7#5': 'm7(♯5)', 'mMaj7#5': 'mMaj7(♯5)', '7b9': '7♭9',
  '6': '6', m6: 'm6', '6b5': '6(♭5)', '6add9': '6/9', m6add9: 'm6/9',
  '9': '9', m9: 'm9', maj9: 'maj9', mMaj9: 'mMaj9', '9b5': '9(♭5)',
  aug9: '9(♯5)', '9sus4': '9sus4', '7#9': '7♯9', '7#9b5': '7♯9(♭5)',
  augMaj9: 'maj9(♯5)', add9: 'add9', '11': '11', m11: 'm11', maj11: 'maj11',
  mMaj11: 'mMaj11', 'maj#11': 'maj♯11', '13': '13', m13: 'm13', maj13: 'maj13',
  mMaj13: 'mMaj13', '7sus2': '7sus2', maj7sus2: 'maj7sus2', '7sus4': '7sus4',
  maj7sus4: 'maj7sus4', '7sus2#5': '7sus2(♯5)', '7sus4#5': '7sus4(♯5)',
};

// ── 오픈 코드 맵 (원본 라인 174-180), 키='C|maj' 등 ──
export const OPEN: Record<string, Fret[]> = {
  'C|maj': ['x', 3, 2, 0, 1, 0], 'C|7': ['x', 3, 2, 3, 1, 0],
  'C|maj7': ['x', 3, 2, 0, 0, 0], 'C|sus4': ['x', 3, 3, 0, 1, 1],
  'A|maj': ['x', 0, 2, 2, 2, 0], 'A|min': ['x', 0, 2, 2, 1, 0],
  'A|7': ['x', 0, 2, 0, 2, 0], 'A|m7': ['x', 0, 2, 0, 1, 0],
  'A|maj7': ['x', 0, 2, 1, 2, 0], 'A|sus4': ['x', 0, 2, 2, 3, 0],
  'G|maj': [3, 2, 0, 0, 0, 3], 'G|7': [3, 2, 0, 0, 0, 1],
  'G|maj7': [3, 2, 0, 0, 0, 2], 'G|sus4': [3, 3, 0, 0, 1, 3],
  'E|maj': [0, 2, 2, 1, 0, 0], 'E|min': [0, 2, 2, 0, 0, 0],
  'E|7': [0, 2, 0, 1, 0, 0], 'E|m7': [0, 2, 0, 0, 0, 0],
  'E|maj7': [0, 2, 1, 1, 0, 0], 'E|sus4': [0, 2, 2, 2, 0, 0],
  'D|maj': ['x', 'x', 0, 2, 3, 2], 'D|min': ['x', 'x', 0, 2, 3, 1],
  'D|7': ['x', 'x', 0, 2, 1, 2], 'D|m7': ['x', 'x', 0, 2, 1, 1],
  'D|maj7': ['x', 'x', 0, 2, 2, 2], 'D|sus4': ['x', 'x', 0, 2, 3, 3],
};

// ── 스케일 정의 (원본 라인 181) ──
export const scaleDefs: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  majpent: [0, 2, 4, 7, 9],
  minpent: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

// ── 스케일 라벨 (원본 라인 182-183) ──
export const scaleLabels: Record<ScaleType, string> = {
  major: '메이저',
  minor: '마이너',
  majpent: '메이저 펜타토닉',
  minpent: '마이너 펜타토닉',
  blues: '블루스',
};
export const scaleLabelsEn: Record<ScaleType, string> = {
  major: 'Major',
  minor: 'Minor',
  majpent: 'Major Pentatonic',
  minpent: 'Minor Pentatonic',
  blues: 'Blues',
};

// ── 잔디 5색 (원본 라인 184) ──
export const GLEVELS: readonly string[] = [
  '#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39',
];

// ── 코드 퀄리티 목록 (원본 라인 185) ──
export const QUALS: readonly Quality[] = [
  'maj', 'min', 'dim', 'aug', 'sus2', 'sus4', 'majb5', 'm#5', 'mbb5',
  'sus4#5', 'sus2b5', 'sus2#5', '7', 'm7', 'maj7', 'mMaj7', 'dim7', 'aug7',
  'augMaj7', '7b5', 'maj7b5', 'm7b5', 'mMaj7b5', 'mMaj7bb5', 'm7#5', 'mMaj7#5',
  '7b9', '6', 'm6', '6b5', '6add9', 'm6add9', '9', 'm9', 'maj9', 'mMaj9',
  '9b5', 'aug9', '9sus4', '7#9', '7#9b5', 'augMaj9', 'add9', '11', 'm11',
  'maj11', 'mMaj11', 'maj#11', '13', 'm13', 'maj13', 'mMaj13', '7sus2',
  'maj7sus2', '7sus4', 'maj7sus4', '7sus2#5', '7sus4#5',
];

// ── 인터벌 (원본 라인 186) — 모든 Quality에 정의 강제 ──
export const INTERVALS: Record<Quality, number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], majb5: [0, 4, 6], 'm#5': [0, 3, 8],
  mbb5: [0, 3, 5], 'sus4#5': [0, 5, 8], sus2b5: [0, 2, 6], 'sus2#5': [0, 2, 8],
  '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  mMaj7: [0, 3, 7, 11], dim7: [0, 3, 6, 9], aug7: [0, 4, 8, 10],
  augMaj7: [0, 4, 8, 11], '7b5': [0, 4, 6, 10], maj7b5: [0, 4, 6, 11],
  m7b5: [0, 3, 6, 10], mMaj7b5: [0, 3, 6, 11], mMaj7bb5: [0, 3, 5, 11],
  'm7#5': [0, 3, 8, 10], 'mMaj7#5': [0, 3, 8, 11], '7b9': [0, 4, 7, 10, 13],
  '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '6b5': [0, 4, 6, 9],
  '6add9': [0, 4, 7, 9, 14], m6add9: [0, 3, 7, 9, 14], '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], mMaj9: [0, 3, 7, 11, 14],
  '9b5': [0, 4, 6, 10, 14], aug9: [0, 4, 8, 10, 14], '9sus4': [0, 5, 7, 10, 14],
  '7#9': [0, 4, 7, 10, 15], '7#9b5': [0, 4, 6, 10, 15],
  augMaj9: [0, 4, 8, 11, 14], add9: [0, 4, 7, 14], '11': [0, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17], maj11: [0, 4, 7, 11, 14, 17],
  mMaj11: [0, 3, 7, 11, 14, 17], 'maj#11': [0, 4, 7, 11, 14, 18],
  '13': [0, 4, 7, 10, 14, 17, 21], m13: [0, 3, 7, 10, 14, 17, 21],
  maj13: [0, 4, 7, 11, 14, 17, 21], mMaj13: [0, 3, 7, 11, 14, 21],
  '7sus2': [0, 2, 7, 10], maj7sus2: [0, 2, 7, 11], '7sus4': [0, 5, 7, 10],
  maj7sus4: [0, 5, 7, 11], '7sus2#5': [0, 2, 8, 10], '7sus4#5': [0, 5, 8, 10],
};

// ── 바레 가능 퀄리티 (원본 라인 187) ──
export const BARRE_OK: ReadonlySet<Quality> = new Set<Quality>([
  'maj', 'min', '7', 'maj7', 'm7', 'sus4',
]);

// ── 코드 그룹 (원본 라인 188-196) ──
export const QGROUPS: readonly ChordGroup[] = [
  {
    id: 'tri', label: '트라이어드 · TRIADS', en: 'TRIADS',
    quals: ['maj', 'min', 'dim', 'aug', 'sus2', 'sus4', 'majb5', 'm#5', 'mbb5', 'sus4#5', 'sus2b5', 'sus2#5'],
  },
  {
    id: 'sev', label: '세븐스 · SEVENTH', en: 'SEVENTH',
    quals: ['7', 'm7', 'maj7', 'mMaj7', 'dim7', 'aug7', 'augMaj7', '7b5', 'maj7b5', 'm7b5', 'mMaj7b5', 'mMaj7bb5', 'm7#5', 'mMaj7#5', '7b9'],
  },
  {
    id: 'six', label: '식스 · SIXTH', en: 'SIXTH',
    quals: ['6', 'm6', '6b5', '6add9', 'm6add9'],
  },
  {
    id: 'nin', label: '나인스 · NINTH', en: 'NINTH',
    quals: ['9', 'm9', 'maj9', 'mMaj9', '9b5', 'aug9', '9sus4', '7#9', '7#9b5', 'augMaj9', 'add9'],
  },
  {
    id: 'ele', label: '일레븐스 · ELEVENTH', en: 'ELEVENTH',
    quals: ['11', 'm11', 'maj11', 'mMaj11', 'maj#11'],
  },
  {
    id: 'thi', label: '써틴스 · THIRTEENTH', en: 'THIRTEENTH',
    quals: ['13', 'm13', 'maj13', 'mMaj13'],
  },
  {
    id: 'sus', label: '서스펜디드 · SUSPENDED', en: 'SUSPENDED',
    quals: ['7sus2', 'maj7sus2', '7sus4', 'maj7sus4', '7sus2#5', '7sus4#5'],
  },
];

// ── 개방현 피치클래스 (다이어그램 음이름용; 원본 라인 197), 6→1번줄 ──
export const OPENPC: readonly number[] = [4, 9, 2, 7, 11, 4];

// ── 개방현 MIDI (보이싱/오디오용; 원본 _enumBase/_collect), 6→1번줄 ──
export const OPEN_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64];

// ── 악보 빌더 박자표 → 박(beat) 수 (원본 beatsOf, 라인 457) ──
export const BEATS: Record<TimeSig, number> = { '4/4': 4, '3/4': 3, '6/8': 6 };
