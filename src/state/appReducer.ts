import { dateStr } from '../domain/notes';
import { ko } from '../i18n/strings';
import {
  addMeasure,
  beatsOf,
  clearSlot,
  emptySequence,
  filledCount,
  makeSheet,
  padSlots,
  placeAt,
  removeMeasure,
  retime,
} from '../domain/sheet';
import type { PersistedState } from './persist';
import type {
  Chord,
  ChordDetail,
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
  KeyType,
  RootIndex,
  ScaleType,
  Sheet,
  SheetSequence,
  SheetSlot,
  TimeSig,
} from '../domain/types';

export type View =
  | 'home'
  | 'dictionary'
  | 'scales'
  | 'practice'
  | 'builder'
  | 'lesson';
export type DictMode = 'key' | 'root';
export type HomeLayout = 'focus' | 'board' | 'minimal';

export interface AppState {
  lang: 'ko' | 'en';
  view: View;
  // 사전/스케일
  selectedRoot: RootIndex;
  keyType: KeyType;
  dictMode: DictMode;
  scaleType: ScaleType;
  query: string;
  // 홈
  homeLayout: HomeLayout;
  // 연습
  grass: GrassMap;
  journal: JournalEntry[];
  drills: Drill[];
  collected: CollectedChord[];
  // 폼 드래프트
  jTitle: string;
  jMin: number | string;
  jChords: string;
  jNotes: string;
  dTitle: string;
  dTarget: number;
  // 악보 빌더 (PR-1) — sheets만 영속(cs_sheets, sheet-persist), 나머지는 트랜션트
  sheets: Sheet[]; // persisted (별도 cs_sheets 키 — 동기화 무간섭)
  sequence: SheetSequence; // 트랜션트 (작업 중 악보)
  armedChord: SheetSlot | null; // 트랜션트 (팔레트에서 고른 코드)
  timeSig: TimeSig; // 트랜션트
  sheetTitle: string; // 트랜션트
  // UI 트랜션트
  toast: string;
  detailChord: ChordDetail | null;
}

export type JournalDraftPatch = Partial<
  Pick<AppState, 'jTitle' | 'jMin' | 'jChords' | 'jNotes'>
>;
export type DrillDraftPatch = Partial<Pick<AppState, 'dTitle' | 'dTarget'>>;

export type Action =
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SET_ROOT'; root: RootIndex }
  | { type: 'SET_KEY_TYPE'; keyType: KeyType }
  | { type: 'SET_DICT_MODE'; mode: DictMode }
  | { type: 'SET_SCALE_TYPE'; scaleType: ScaleType }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_HOME_LAYOUT'; layout: HomeLayout }
  | { type: 'OPEN_DETAIL'; chord: Chord }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'COLLECT'; chord: CollectedChord }
  | { type: 'REMOVE_COLLECTED'; index: number }
  | { type: 'LOG_PRACTICE' }
  | { type: 'ADD_JOURNAL' }
  | { type: 'SET_JOURNAL_DRAFT'; patch: JournalDraftPatch }
  | { type: 'ADD_DRILL' }
  | { type: 'SET_DRILL_COUNT'; id: string; n: number }
  | { type: 'BUMP_DRILL_TARGET'; id: string; delta: number }
  | { type: 'REMOVE_DRILL'; id: string }
  | { type: 'RESET_DRILLS' }
  | { type: 'SET_DRILL_DRAFT'; patch: DrillDraftPatch }
  | { type: 'SHOW_TOAST'; msg: string }
  | { type: 'CLEAR_TOAST' }
  // 악보 빌더 (PR-1)
  | { type: 'ARM_CHORD'; chord: SheetSlot }
  | { type: 'PLACE_AT'; index: number }
  | { type: 'CLEAR_SLOT'; index: number }
  | { type: 'ADD_MEASURE' }
  | { type: 'REMOVE_MEASURE'; measureIndex: number }
  | { type: 'SET_TIME_SIG'; timeSig: TimeSig }
  | { type: 'SET_SHEET_TITLE'; title: string }
  | { type: 'CLEAR_SEQUENCE' }
  | { type: 'SAVE_SHEET' }
  | { type: 'LOAD_SHEET'; id: string }
  | { type: 'DELETE_SHEET'; id: string }
  | { type: 'HYDRATE'; persisted: PersistedState };

/**
 * persisted slice + 트랜션트 기본값으로 초기 상태 구성.
 *
 * `sheets`는 동기화 계층(PersistedState)과 분리된 별도 슬라이스(cs_sheets)이므로
 * 2번째 인자로 주입한다(sheet-persist.loadSheets() 경유). 미지정 시 빈 배열.
 * PR-1 결정: 시드 악보 없음 → 첫 진입은 빈 8칸(4/4 2마디)로 시작.
 */
export function initState(
  persisted: PersistedState,
  sheets: Sheet[] = [],
): AppState {
  return {
    lang: persisted.lang,
    view: 'home',
    selectedRoot: 0,
    keyType: 'major',
    dictMode: 'key',
    scaleType: 'major',
    query: '',
    homeLayout: 'focus',
    grass: persisted.grass,
    journal: persisted.journal,
    drills: persisted.drills,
    collected: persisted.collected,
    jTitle: '',
    jMin: 30,
    jChords: '',
    jNotes: '',
    dTitle: '',
    dTarget: 5,
    sheets,
    sequence: emptySequence(beatsOf('4/4')),
    armedChord: null,
    timeSig: '4/4',
    sheetTitle: '',
    toast: '',
    detailChord: null,
  };
}

function bumpToday(grass: GrassMap): GrassMap {
  const ds = dateStr(new Date());
  return { ...grass, [ds]: (grass[ds] || 0) + 1 };
}

const clampTarget = (n: number): number => Math.max(1, Math.min(40, n));

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_ROOT':
      return { ...state, selectedRoot: action.root };
    case 'SET_KEY_TYPE':
      return { ...state, keyType: action.keyType };
    case 'SET_DICT_MODE':
      return { ...state, dictMode: action.mode };
    case 'SET_SCALE_TYPE':
      return { ...state, scaleType: action.scaleType };
    case 'SET_QUERY':
      return { ...state, query: action.query };
    case 'SET_HOME_LAYOUT':
      return { ...state, homeLayout: action.layout };

    case 'OPEN_DETAIL':
      return {
        ...state,
        detailChord: {
          root: action.chord.root,
          qualKey: action.chord.qualKey,
          name: action.chord.name,
        },
      };
    case 'CLOSE_DETAIL':
      return { ...state, detailChord: null };

    case 'COLLECT': {
      const exists = state.collected.some((c) => c.name === action.chord.name);
      if (exists) {
        return { ...state, toast: ko.alreadyCollected(action.chord.name) };
      }
      const collected = [
        ...state.collected,
        {
          name: action.chord.name,
          frets: action.chord.frets,
          key: action.chord.name,
        },
      ];
      return { ...state, collected, toast: ko.collected(action.chord.name) };
    }
    case 'REMOVE_COLLECTED':
      return {
        ...state,
        collected: state.collected.filter((_, i) => i !== action.index),
      };

    case 'LOG_PRACTICE':
      return {
        ...state,
        grass: bumpToday(state.grass),
        toast: ko.logPracticeToast,
      };

    case 'ADD_JOURNAL': {
      if (!String(state.jTitle).trim()) {
        return { ...state, toast: ko.journalNeedTitle };
      }
      const ds = dateStr(new Date());
      const entry: JournalEntry = {
        id: 'j' + Date.now(),
        date: ds,
        title: String(state.jTitle).trim(),
        minutes: Number(state.jMin) || 0,
        chords: String(state.jChords)
          .split(/[ ,]+/)
          .filter(Boolean),
        notes: String(state.jNotes).trim(),
      };
      return {
        ...state,
        journal: [entry, ...state.journal],
        grass: bumpToday(state.grass),
        jTitle: '',
        jMin: 30,
        jChords: '',
        jNotes: '',
        toast: ko.journalSaved,
      };
    }
    case 'SET_JOURNAL_DRAFT':
      return { ...state, ...action.patch };

    case 'ADD_DRILL': {
      const title = state.dTitle.trim();
      if (!title) {
        return { ...state, toast: ko.drillNeedTitle };
      }
      const target = clampTarget(Number(state.dTarget) || 5);
      const drill: Drill = { id: 'd' + Date.now(), title, target, count: 0 };
      return {
        ...state,
        drills: [...state.drills, drill],
        dTitle: '',
        dTarget: 5,
      };
    }
    case 'SET_DRILL_COUNT': {
      const before = state.drills.find((d) => d.id === action.id);
      const drills = state.drills.map((d) =>
        d.id === action.id ? { ...d, count: Math.max(0, action.n) } : d,
      );
      const after = drills.find((d) => d.id === action.id);
      // before<target && after>=target 전이 순간에만 잔디+1 + 토스트
      if (
        before &&
        after &&
        after.count >= after.target &&
        before.count < before.target
      ) {
        return {
          ...state,
          drills,
          grass: bumpToday(state.grass),
          toast: ko.drillGoalReached(after.title),
        };
      }
      return { ...state, drills };
    }
    case 'BUMP_DRILL_TARGET':
      return {
        ...state,
        drills: state.drills.map((d) =>
          d.id === action.id
            ? { ...d, target: clampTarget(d.target + action.delta) }
            : d,
        ),
      };
    case 'REMOVE_DRILL':
      return {
        ...state,
        drills: state.drills.filter((d) => d.id !== action.id),
      };
    case 'RESET_DRILLS':
      return {
        ...state,
        drills: state.drills.map((d) => ({ ...d, count: 0 })),
        toast: ko.drillCleared,
      };
    case 'SET_DRILL_DRAFT':
      return { ...state, ...action.patch };

    case 'SHOW_TOAST':
      return { ...state, toast: action.msg };
    case 'CLEAR_TOAST':
      return { ...state, toast: '' };

    // ── 악보 빌더 (PR-1) — 계산은 domain/sheet.ts 위임, reducer 순수 유지 ──
    case 'ARM_CHORD': {
      // 같은 코드 재클릭 → 해제(토글). 원본 armChord (라인 459): name + frets JSON 비교.
      const a = state.armedChord;
      const same =
        !!a &&
        a.name === action.chord.name &&
        JSON.stringify(a.frets) === JSON.stringify(action.chord.frets);
      return {
        ...state,
        armedChord: same
          ? null
          : { name: action.chord.name, frets: action.chord.frets },
      };
    }
    case 'PLACE_AT': {
      // armed 있음 → 배치 / 없음 + 채워짐 → 비우기 / 없음 + 빈칸 → 안내 토스트 (원본 beatCell 라인 631).
      if (state.armedChord) {
        return {
          ...state,
          sequence: placeAt(state.sequence, action.index, state.armedChord),
        };
      }
      if (state.sequence[action.index]) {
        return {
          ...state,
          sequence: clearSlot(state.sequence, action.index),
        };
      }
      return { ...state, toast: ko.builderSelectFirst };
    }
    case 'CLEAR_SLOT':
      return { ...state, sequence: clearSlot(state.sequence, action.index) };
    case 'ADD_MEASURE':
      return {
        ...state,
        sequence: addMeasure(state.sequence, beatsOf(state.timeSig)),
      };
    case 'REMOVE_MEASURE':
      return {
        ...state,
        sequence: removeMeasure(
          state.sequence,
          action.measureIndex,
          beatsOf(state.timeSig),
        ),
      };
    case 'SET_TIME_SIG':
      return {
        ...state,
        timeSig: action.timeSig,
        sequence: retime(state.sequence, beatsOf(action.timeSig)),
      };
    case 'SET_SHEET_TITLE':
      return { ...state, sheetTitle: action.title };
    case 'CLEAR_SEQUENCE':
      return { ...state, sequence: emptySequence(beatsOf(state.timeSig)) };
    case 'SAVE_SHEET': {
      // 채워진 박 0개면 토스트 후 중단 (원본 saveSheet 라인 468).
      if (filledCount(state.sequence) === 0) {
        return { ...state, toast: ko.builderNeedChord };
      }
      const sheet = makeSheet(
        state.sheetTitle || ko.builderUntitled,
        state.sequence,
        state.timeSig,
        dateStr(new Date()),
      );
      return {
        ...state,
        sheets: [sheet, ...state.sheets],
        toast: ko.builderSaved,
      };
    }
    case 'LOAD_SHEET': {
      const sh = state.sheets.find((x) => x.id === action.id);
      if (!sh) return state;
      return {
        ...state,
        sequence: padSlots(sh.seq, beatsOf(sh.timeSig)),
        timeSig: sh.timeSig,
        sheetTitle: sh.title,
        toast: ko.builderLoaded(sh.title),
      };
    }
    case 'DELETE_SHEET':
      return {
        ...state,
        sheets: state.sheets.filter((s) => s.id !== action.id),
      };

    case 'HYDRATE':
      // 서버 pull/merge 결과로 persisted 4슬라이스 + lang만 교체.
      // 트랜션트(view/드래프트/toast/detail 등)는 spread로 보존(순수 — §4.2).
      return {
        ...state,
        grass: action.persisted.grass,
        journal: action.persisted.journal,
        drills: action.persisted.drills,
        collected: action.persisted.collected,
        lang: action.persisted.lang,
      };

    default: {
      // 완전성 보장 (모든 Action 처리)
      const _exhaustive: never = action;
      return state ?? _exhaustive;
    }
  }
}
