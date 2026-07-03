import { describe, it, expect, beforeEach } from 'vitest';
import { KEYS } from '../persist';
import {
  userKeyPrefix,
  queueKey,
  userCacheKeys,
  clearUserCache,
} from '../user-keys';

/**
 * user-keys 헬퍼 + 로그아웃 물리 정리(PR⑤ 후속 · AC⑤-9 공유기기 프라이버시).
 * QA O5: 이전엔 이 이연을 고정하는 테스트가 없었다 — 여기서 관측한다.
 */
describe('user-keys — key derivation', () => {
  it('userKeyPrefix / queueKey follow the u:{uid}: namespace', () => {
    expect(userKeyPrefix('abc')).toBe('u:abc:');
    expect(queueKey('abc')).toBe('u:abc:cs_queue');
  });

  it('userCacheKeys covers every cs_* key + the queue key', () => {
    const keys = userCacheKeys('abc');
    for (const base of Object.values(KEYS)) {
      expect(keys).toContain(`u:abc:${base}`);
    }
    expect(keys).toContain(queueKey('abc'));
  });
});

describe('clearUserCache — 로그아웃 물리 정리', () => {
  beforeEach(() => localStorage.clear());

  it('removes all of this user cache + queue keys from localStorage', () => {
    const uid = 'me';
    for (const k of userCacheKeys(uid)) localStorage.setItem(k, 'x');
    // sanity: present before
    for (const k of userCacheKeys(uid)) expect(localStorage.getItem(k)).toBe('x');

    clearUserCache(uid);

    for (const k of userCacheKeys(uid)) expect(localStorage.getItem(k)).toBeNull();
  });

  it('does NOT touch legacy cs_* keys (비로그인 로컬 모드 무손상)', () => {
    localStorage.setItem(KEYS.grass, 'legacy');
    localStorage.setItem(KEYS.journal, 'legacy');
    localStorage.setItem(`u:me:${KEYS.grass}`, 'x');

    clearUserCache('me');

    expect(localStorage.getItem(KEYS.grass)).toBe('legacy');
    expect(localStorage.getItem(KEYS.journal)).toBe('legacy');
    expect(localStorage.getItem(`u:me:${KEYS.grass}`)).toBeNull();
  });

  it('does NOT touch another user namespace (다계정 격리 유지)', () => {
    localStorage.setItem(`u:other:${KEYS.grass}`, 'keep');
    localStorage.setItem(queueKey('other'), 'keep');
    localStorage.setItem(`u:me:${KEYS.grass}`, 'x');
    localStorage.setItem(queueKey('me'), 'x');

    clearUserCache('me');

    expect(localStorage.getItem(`u:other:${KEYS.grass}`)).toBe('keep');
    expect(localStorage.getItem(queueKey('other'))).toBe('keep');
    expect(localStorage.getItem(`u:me:${KEYS.grass}`)).toBeNull();
    expect(localStorage.getItem(queueKey('me'))).toBeNull();
  });
});
