import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../domain/types';
import type { PersistedState } from './persist';
import type { RepoChange } from './repo-change';

/**
 * 영속화 추상화 인터페이스.
 *
 * 목적: AppContext가 localStorage(또는 추후 Supabase/SyncRepo)를 직접
 * 만지지 않게 한다. 본 PR은 LocalRepository(localStorage 구현)만 도입하고,
 * SupabaseRepository/SyncRepository는 후속 PR에서 추가한다.
 *
 * 메서드 계약:
 *   - 현 persist 키(KEYS - cs_grass, cs_journal, cs_drills, cs_collected, cs_lang)와
 *     동일한 JSON shape를 유지한다 (외부 호환 + 기존 영속 데이터 호환).
 *   - get/list 메서드는 영속소가 비었거나 손상되었을 때 시드 폴백을 한다
 *     (legacy load와 동일 정책).
 *   - set/save 메서드는 직렬화 실패나 quota 예외를 삼킨다 (legacy save와 동일).
 */
export type Lang = 'ko' | 'en';

export interface Repository {
  // ── 일괄 로드/저장 (AppContext 초기화/effect용) ──
  /** 모든 영속 슬라이스를 한 번에 로드 (legacy `load()` 대체). */
  loadAll(): PersistedState;
  /** 부분 영속 상태 저장 (legacy `save(Partial)` 대체). */
  saveAll(patch: Partial<PersistedState>): void;

  // ── 잔디 ──
  getGrass(): GrassMap;
  setGrass(grass: GrassMap): void;

  // ── 연습 일지 ──
  listJournal(): JournalEntry[];
  setJournal(journal: JournalEntry[]): void;

  // ── 드릴 ──
  listDrills(): Drill[];
  setDrills(drills: Drill[]): void;

  // ── 담은 코드 ──
  listCollected(): CollectedChord[];
  setCollected(collected: CollectedChord[]): void;

  // ── 언어 ──
  getLang(): Lang;
  setLang(lang: Lang): void;
}

/**
 * 비동기 영속화 어댑터(SyncRepo — PR⑤).
 *
 * 동기 `Repository`를 승급하지 않고 별도 인터페이스로 신설한다(계획 17 §4.1).
 * AppProvider는 주입된 repo의 종류(타입 가드 isAsyncRepository)에 따라
 * 두 초기화 경로 중 하나를 탄다:
 *   - 동기 Repository/주입 없음 → 기존 loadAll()/saveAll(patch) 경로(회귀 0).
 *   - AsyncRepository        → loadCached() 즉시 + start() 백그라운드 pull.
 *
 * load 계약("캐시 즉시 반환"):
 *   - loadCached(): 로컬 user-prefix 캐시를 즉시 동기 반환 → 초기 렌더 blocking 없음.
 *   - start(onMerged): 백그라운드 pull→merge 시작. merge 결과를 콜백 통지(초기 pull 완료 시 1회).
 *   - apply(changes): 캐시 즉시 머지 + 큐 적재 + (온라인) push.
 *   - dispose(): 리스너/타이머 정리(online 이벤트 등, 멱등).
 */
export interface AsyncRepository {
  /** 로컬 user-prefix 캐시 즉시 반환(동기). 없으면 빈 상태(seed 미적용 — AC⑤-8). */
  loadCached(): PersistedState;
  /** 백그라운드 pull→merge 시작. 머지된 PersistedState를 통지(초기 pull 완료 시 1회). */
  start(onMerged: (merged: PersistedState) => void): void;
  /** 변경 적용: 캐시 즉시 머지 + 큐 적재 + (온라인) push. */
  apply(changes: RepoChange[]): Promise<void>;
  /** 리스너/타이머 정리(멱등). */
  dispose(): void;
}

/** 주입 repo 판별(타입 가드). AppProvider가 경로 분기에 사용(§4.1). */
export function isAsyncRepository(
  r: Repository | AsyncRepository,
): r is AsyncRepository {
  return typeof (r as AsyncRepository).loadCached === 'function';
}
