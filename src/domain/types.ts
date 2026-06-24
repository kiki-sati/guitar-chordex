// ── 음이름 / 피치클래스 ──
export type Note =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export type PitchClass = number; // 0..11
export type RootIndex = number; // 0..11 (NOTE 인덱스)

// ── 코드 퀄리티 (QUALS 키와 동일한 리터럴 유니온; SUF/INTERVALS 키와 1:1) ──
export type Quality =
  | 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'majb5' | 'm#5' | 'mbb5'
  | 'sus4#5' | 'sus2b5' | 'sus2#5' | '7' | 'm7' | 'maj7' | 'mMaj7' | 'dim7'
  | 'aug7' | 'augMaj7' | '7b5' | 'maj7b5' | 'm7b5' | 'mMaj7b5' | 'mMaj7bb5'
  | 'm7#5' | 'mMaj7#5' | '7b9' | '6' | 'm6' | '6b5' | '6add9' | 'm6add9'
  | '9' | 'm9' | 'maj9' | 'mMaj9' | '9b5' | 'aug9' | '9sus4' | '7#9' | '7#9b5'
  | 'augMaj9' | 'add9' | '11' | 'm11' | 'maj11' | 'mMaj11' | 'maj#11'
  | '13' | 'm13' | 'maj13' | 'mMaj13' | '7sus2' | 'maj7sus2' | '7sus4'
  | 'maj7sus4' | '7sus2#5' | '7sus4#5';

// ── 한 줄 운지: 'x'=뮤트, 0=개방현, 양수=프렛 ──
export type Fret = number | 'x';
// 6현, 인덱스 0=6번줄(저음 E), …, 5=1번줄(고음 e)  ← 원본 frets 배열 순서
export type FretArray = Fret[]; // 항상 length 6 (런타임 보장)

// ── 코드 (buildChord 반환) ──
export interface Chord {
  name: string; // 예: 'Cmaj7' (noteName + SUF[qual])
  frets: FretArray; // 6칸
  root: RootIndex; // 0..11
  qualKey: Quality;
  key: string; // = name (리스트 key 용도, 원본 호환)
  roman?: string; // diatonic()에서만 부여 (예: 'Imaj7')
}

// ── 보이싱 후보 (내부 _collect 결과) ──
export interface VoicingCandidate {
  frets: FretArray;
  pos: number; // 다이어그램 시작 프렛 기준 위치 (mx>0?mn:0)
  score: number; // 낮을수록 우수
}

// ── 다이어그램 기하 (computeDiagram 반환) ──
export interface DiagramMarker {
  s: number;
  type: 'mute' | 'open';
} // s=현 인덱스 0..5
export interface DiagramDot {
  s: number;
  row: number;
} // row=1..5 (start 기준)
export interface DiagramGeometry {
  start: number; // 시작 프렛 (1 또는 mn)
  span: number; // 5 고정
  showNut: boolean; // start===1
  dots: DiagramDot[];
  markers: DiagramMarker[];
}

// ── 스케일 ──
export type ScaleType = 'major' | 'minor' | 'majpent' | 'minpent' | 'blues';

// ── 다이어토닉 키 타입 ──
export type KeyType = 'major' | 'minor';

// ── 연습 기록 도메인 ──
export type GrassMap = Record<string, number>; // 'YYYY-MM-DD' → 횟수
export type GrassLevel = 0 | 1 | 2 | 3 | 4;
export interface GrassDay {
  ds: string;
  count: number;
  level: GrassLevel;
  date: Date;
}
export type GrassWeek = (GrassDay | null)[]; // 길이 7 (요일)

export interface Stats {
  total: number;
  days: number;
  streak: number;
  week: number;
}

export interface DrillSeqItem {
  name: string;
  frets: FretArray;
}
export interface Drill {
  id: string;
  title: string;
  target: number; // 1..40
  count: number; // 0..
  seq?: DrillSeqItem[]; // 후속(악보 연동) 슬롯
  sheetId?: string; // 후속 슬롯
  timeSig?: string; // 후속 슬롯
}

export interface JournalEntry {
  id: string;
  date: string; // 'YYYY-MM-DD'
  title: string;
  minutes: number;
  chords: string[]; // 코드명 문자열
  notes: string;
}

// ── 담은 코드 (collected; 후속 악보용이나 board/minimal 홈에서 표시) ──
export interface CollectedChord {
  name: string;
  frets: FretArray;
  key: string;
}

// ── 다이어그램 렌더 variant ──
export type DiagramVariant = 'dots' | 'tones';

// ── 코드 그룹 (QGROUPS) ──
export interface ChordGroup {
  id: string;
  label: string;
  en: string;
  quals: Quality[];
}

// ── 코드 상세 (모달 입력) ──
export interface ChordDetail {
  root: RootIndex;
  qualKey: Quality;
  name: string;
}
