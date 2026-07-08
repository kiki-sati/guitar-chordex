import type { Sheet } from '../domain/types';

/**
 * 악보 빌더 전용 영속화 유틸 (PR-1 · 로컬 전용).
 *
 * **동기화 계층과 완전 분리** (계획 §6.3):
 *   - sheets는 PersistedState/Repository/diffChanges/applyChanges/SyncRepo를
 *     일절 거치지 않는다 → 서버로 새지 않음(PR-2에서 동기화 도입).
 *   - localStorage 키 `cs_sheets`에 직접 read/write하되, 손상/quota 예외는 삼킨다
 *     (기존 LocalRepository의 관용 정책과 동일 계약).
 *
 * PR-1 결정(사용자 확정): 시드 악보 없음 → 첫 진입 빈 배열. 로그인 유저도 로컬만.
 */
export const SHEETS_KEY = 'cs_sheets' as const;

/** cs_sheets에서 악보 목록 로드. 비었거나 손상 시 빈 배열. */
export function loadSheets(): Sheet[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SHEETS_KEY) || 'null',
    ) as Sheet[] | null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** cs_sheets에 악보 목록 저장. quota/직렬화 예외 삼킴. */
export function saveSheets(sheets: Sheet[]): void {
  try {
    localStorage.setItem(SHEETS_KEY, JSON.stringify(sheets));
  } catch {
    /* no-op (quota / private mode / SSR) */
  }
}
