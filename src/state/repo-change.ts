import type {
  CollectedChord,
  Drill,
  JournalEntry,
} from '../domain/types';
import type { Lang } from './repository';

/**
 * 엔티티별 변경 단위 (정본 05 §5.2, 계획 17 §2.1).
 *
 * reducer 결과 diff(diff-changes.ts)에서 산출하며, 큐/머지/푸시의 공통 단위다.
 * React·supabase 무의존 — 테스트 1급 모듈.
 *
 * 불변(변경 시 사용자 확인):
 *   - grass는 per-day **절대 최종값**(count)을 실어 나른다(델타 아님, §2.1).
 *     서버 upsert는 (user_id,day) 멱등 → 같은 change 2회 = 같은 최종값(AC⑤-5).
 *   - collected는 name 자연키(id 없음, CollectedChord 불변 — §5 D4).
 */
export type RepoChange =
  | { kind: 'grass'; day: string; count: number }
  | { kind: 'journal'; op: 'upsert'; entry: JournalEntry }
  | { kind: 'journal'; op: 'delete'; id: string }
  | { kind: 'drill'; op: 'upsert'; drill: Drill; sortOrder: number }
  | { kind: 'drill'; op: 'delete'; id: string }
  | { kind: 'collected'; op: 'upsert'; chord: CollectedChord }
  | { kind: 'collected'; op: 'delete'; name: string }
  | { kind: 'lang'; lang: Lang };

/** 큐 항목: change + LWW 기준 타임스탬프 + 멱등 식별자 (§2.1). */
export interface QueueItem {
  /** 큐 내 항목 식별(재시도 추적용). crypto.randomUUID(). */
  id: string;
  change: RepoChange;
  /** 이 change의 LWW 기준(생성 시각, ISO). 재시도해도 불변. */
  updatedAt: string;
}
