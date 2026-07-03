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
