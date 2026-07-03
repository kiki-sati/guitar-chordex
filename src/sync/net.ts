/**
 * 온라인 감지 (계획 17 §3). React·supabase 무의존 — 테스트 1급 모듈.
 *
 * PR⑤ 범위: web `navigator.onLine` + `online` 이벤트만.
 * 네이티브(@capacitor/network) 고도화는 PR⑥ 범위 밖(사용자 확정 Q4).
 */

/** 현재 온라인 여부. SSR/비브라우저 방어: navigator 부재 시 true(낙관). */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** online 이벤트 리스너 등록. 반환값은 해제 함수(멱등). */
export function onOnline(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', cb);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    window.removeEventListener('online', cb);
  };
}
