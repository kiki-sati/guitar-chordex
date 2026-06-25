import type { ScaleType } from '../domain/types';

/**
 * MVP는 한국어(ko) 단일. 모든 UI 문자열은 이 맵을 경유해 하드코딩을 피하고,
 * 후속 EN 토글 시 en 맵만 추가하면 된다. (계획 §9 i18n)
 */
export type Lang = 'ko' | 'en';

export const ko = {
  brand: 'Chordex',
  // nav
  navHome: '홈',
  navDictionary: '코드 사전',
  navScales: '스케일',
  navBuilder: '악보 만들기',
  navPractice: '연습 기록',
  navLesson: '레슨 기록',
  // sidebar foot
  thisWeek: '이번 주 · THIS WEEK',
  // header titles: [title, subtitle, eyebrow]
  headerLogBtn: '오늘 연습 기록',
  searchPlaceholder: '코드 검색 (예: Am7, F)',
  // dictionary
  byKey: '키별 코드',
  byRoot: '루트별 코드',
  diatonicTitle: '키의 다이어토닉 코드',
  diatonicSub: '이 스케일 안에서 자연스럽게 어울리는 7개 코드',
  listenAll: '▶ 전체 듣기',
  rootSuffix: '루트',
  searchResult: (n: number) => '검색 결과 ' + n + '개',
  searchEmpty: (q: string) => '"' + q + '" 와 일치하는 코드가 없어요',
  // card
  tipAllForms: '클릭하면 모든 폼 보기',
  actPlay: '재생',
  actCollect: '담기',
  actCopy: '복사',
  actAllForms: '모든 폼',
  comingSoon: '준비 중',
  // modal
  allVoicings: (n: number) => '🎸 ALL VOICINGS · ' + n + '폼',
  modalEmpty: '이 코드의 표준 폼을 찾지 못했어요.',
  formOpen: 'OPEN',
  // collect toasts
  alreadyCollected: (name: string) => name + ' 은 이미 담겨있어요',
  collected: (name: string) => name + ' 담음 · 악보에서 편성하세요',
  // scales
  scaleTitleSuffix: '스케일',
  scaleNoteMeta: (n: number) => n + '개 음 · 지판 전체 포지션',
  legendRoot: '루트음',
  legendNote: '스케일 구성음',
  // practice stats
  statStreak: ' 연속 연습 중',
  statDays: ' 총 연습한 날',
  statWeek: ' 이번 주 세션',
  statTotal: ' 누적 세션',
  // drills
  drillTitle: '오늘 연습할 것',
  drillSub: (done: number, total: number) =>
    '한 번 연습할 때마다 동그라미를 하나씩 채우세요 · 오늘 ' + done + '/' + total + ' 완료',
  drillClear: '체크 비우기',
  drillEmpty:
    '연습할 내용을 추가해보세요. 한 번 연습할 때마다 동그라미를 채우면 돼요.',
  drillInputPlaceholder: '연습할 내용 (예: F 바레코드 천천히)',
  drillTargetLabel: '목표',
  drillTargetUnit: '번',
  drillAdd: '추가',
  drillGoalReached: (title: string) => title + ' 목표 달성! 잔디 +1',
  drillCleared: '오늘 체크를 모두 비웠어요',
  drillNeedTitle: '연습할 내용을 입력하세요',
  drillBumpDown: '목표 줄이기',
  drillBumpUp: '목표 늘리기',
  drillDelete: '삭제',
  // grass
  grassTitle: '연습 잔디 · 최근 1년',
  grassLog: '＋ 오늘 연습 기록',
  grassLess: '적음',
  grassMore: '많음',
  grassTotal: (n: number) => n + '회 누적',
  // journal
  journalWrite: '연습 일지 쓰기',
  journalTitlePlaceholder: '오늘 무엇을 연습했나요?',
  journalMinPlaceholder: '분',
  journalMinUnit: '분',
  journalChordsPlaceholder: '연습한 코드 (예: C G Am F)',
  journalNotesPlaceholder: '느낀 점, 어려웠던 부분, 다음 목표...',
  journalSubmit: '일지 기록 + 잔디 심기',
  journalRecords: (n: number) => '기록 (' + n + ')',
  journalNeedTitle: '제목을 입력하세요',
  journalSaved: '연습 일지를 기록했어요',
  // log practice
  logPracticeToast: '오늘 연습 +1 · 잔디가 자랐어요',
  // home
  layoutFocus: '포커스',
  layoutBoard: '대시보드',
  layoutMinimal: '미니멀',
  homeStreakEyebrow: '🔥 STREAK',
  homeStreakUnit: '일째',
  homeLogBtn: '오늘 연습 기록하기',
  homeGrassTitle: '연습 잔디',
  homeSuggestTitle: '오늘의 추천 코드',
  homeListen: '▶ 듣기',
  homeRecentJournal: '최근 일지',
  homeNoJournal: '아직 일지가 없어요',
  homeStreakLabel: '연속 연습',
  homeLogShort: '＋ 오늘 기록',
  homeCollected: (n: number) => '담은 코드 (' + n + ')',
  homeToBuilder: '악보 만들기 →',
  daySuffix: '일',
  timesSuffix: '회',
} as const;

/** 헤더 타이틀 맵: [title, subtitle, eyebrow] */
export const headerTitles: Record<
  string,
  [title: string, subtitle: string, eyebrow: string]
> = {
  home: ['홈', '다시 만나서 반가워요. 오늘도 한 곡 연습해볼까요?', '🏠 OVERVIEW'],
  dictionary: [
    '코드 사전',
    '키와 루트별로 코드 다이어그램을 찾고, 듣고, 모아보세요',
    '📖 CHORD LIBRARY',
  ],
  scales: ['스케일', '지판 위에서 스케일 구성음을 익혀보세요', '🎼 SCALES'],
  builder: [
    '악보 만들기',
    '담은 코드를 마디에 배치해 나만의 코드 진행을 만드세요',
    '🎵 SHEET BUILDER',
  ],
  practice: [
    '연습 기록',
    '연습할 것을 적고 한 번씩 체크하며, 잔디로 꾸준함을 쌓으세요',
    '✅ PRACTICE LOG',
  ],
  lesson: [
    '레슨 기록',
    '선생님께 배운 내용과 숙제를 기록하고 연습으로 이어가세요',
    '🎓 LESSON LOG',
  ],
};

/** 스케일 라벨 (한국어). */
export const scaleLabelKo: Record<ScaleType, string> = {
  major: '메이저',
  minor: '마이너',
  majpent: '메이저 펜타토닉',
  minpent: '마이너 펜타토닉',
  blues: '블루스',
};
