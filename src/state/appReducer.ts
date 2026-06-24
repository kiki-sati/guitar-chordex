import { dateStr } from '../domain/notes';
import { ko } from '../i18n/strings';
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
  | { type: 'CLEAR_TOAST' };

/** persisted slice + 트랜션트 기본값으로 초기 상태 구성. */
export function initState(persisted: PersistedState): AppState {
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

    default: {
      // 완전성 보장 (모든 Action 처리)
      const _exhaustive: never = action;
      return state ?? _exhaustive;
    }
  }
}
