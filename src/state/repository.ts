import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../domain/types';
import type { PersistedState } from './persist';

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
