import { KEYS } from './persist';

/**
 * 인증 유저 캐시 키 prefix (계획 17 §6.2). SyncRepo·큐·마이그레이션·로그아웃
 * 정리에서 공유한다. legacy(비로그인) 키(`cs_*`)와 명확히 구분된다.
 *
 * 예) userKeyPrefix('abc') + KEYS.grass = 'u:abc:cs_grass'
 */
export function userKeyPrefix(uid: string): string {
  return `u:${uid}:`;
}

/** 큐 키: `${userKeyPrefix(uid)}cs_queue` (§8.2). */
export function queueKey(uid: string): string {
  return `${userKeyPrefix(uid)}cs_queue`;
}

/** 인증 유저 캐시가 사용하는 모든 localStorage 키(로그아웃 정리용, AC⑤-9). */
export function userCacheKeys(uid: string): string[] {
  const prefix = userKeyPrefix(uid);
  return [
    ...Object.values(KEYS).map((base) => `${prefix}${base}`),
    queueKey(uid),
  ];
}

/**
 * 로그아웃 시 이 uid의 캐시·큐(`u:{uid}:cs_*` + `u:{uid}:cs_queue`)를
 * localStorage에서 물리 삭제한다(AC⑤-9 · 공유기기 프라이버시). React 무의존 → 단위 테스트 1급.
 *
 * `userCacheKeys`가 큐 키를 이미 포함하므로 별도 `queue.clear()`는 불필요(이 루프가 큐도 제거).
 * legacy(비로그인) `cs_*`·다른 uid 네임스페이스는 건드리지 않는다(회귀 0, 다계정 격리 유지).
 */
export function clearUserCache(uid: string): void {
  for (const key of userCacheKeys(uid)) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* no-op (private mode / quota / SSR) */
    }
  }
}
