/**
 * 온라인 감지 (설계 §2.3 · N3). React·supabase 무의존 — 테스트 1급 모듈.
 *
 * 공개 시그니처는 불변(계약): 소비자 sync-repository.ts 무변경.
 *  - isOnline(): boolean            — 동기. 웹=navigator.onLine, 네이티브=캐시값.
 *  - onOnline(cb): () => void       — online 전이 시 cb. 반환값은 해제 함수(멱등).
 *
 * 네이티브(@capacitor/network)는 getStatus()가 비동기이므로, 동기 isOnline()을
 * 유지하기 위해 모듈 로드 시 상태를 캐시하고 addListener로 갱신한다.
 * 미확정 시 낙관(true) 폴백 — 기존 정책과 일관(설계 R3).
 */
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// ── 네이티브 캐시 상태 ────────────────────────────────────────────
// 로드 직후 getStatus resolve 전까지는 낙관적 online(true).
let nativeConnected = true;
// 온라인 전이(false→true) 감지용 콜백 집합.
const onlineCallbacks = new Set<() => void>();

if (isNative) {
  void (async () => {
    const { Network } = await import('@capacitor/network');
    // 리스너를 먼저 등록해 로드 직후 상태 변화를 놓치지 않는다.
    void Network.addListener('networkStatusChange', (status) => {
      const wasConnected = nativeConnected;
      nativeConnected = status.connected;
      // false → true 전이에서만 online 콜백 발화.
      if (status.connected && !wasConnected) {
        onlineCallbacks.forEach((cb) => cb());
      }
    });
    try {
      const status = await Network.getStatus();
      nativeConnected = status.connected;
    } catch {
      // getStatus 실패 시 낙관적 true 유지(폴백).
    }
  })();
}

/** 현재 온라인 여부(동기). 웹=navigator.onLine, 네이티브=캐시값. */
export function isOnline(): boolean {
  if (isNative) return nativeConnected;
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** online 전이 리스너 등록. 반환값은 해제 함수(멱등). */
export function onOnline(cb: () => void): () => void {
  if (isNative) {
    onlineCallbacks.add(cb);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      onlineCallbacks.delete(cb);
    };
  }

  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', cb);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    window.removeEventListener('online', cb);
  };
}
