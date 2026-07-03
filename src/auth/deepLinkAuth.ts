/**
 * 딥링크 콜백 URL 파서 (순수 함수 — 테스트 1급, 설계 §2.1 · §부록).
 *
 * React·Capacitor·supabase 전부 무의존. URL 문자열 in → 판별 결과 out.
 * 이 함수는 세션을 만들지 않는다("무엇을 교환해야 하는가"만 판별). 실제
 * exchangeCodeForSession/setSession 호출은 native.ts 리스너(supabase 소유)가 수행한다.
 */

/** 딥링크 콜백 URL 파싱 결과 (판별 유니온 — 불가능 상태 차단). */
export type AuthCallback =
  | { kind: 'code'; code: string } // PKCE: ?code=... → exchangeCodeForSession
  | { kind: 'tokens'; accessToken: string; refreshToken: string } // implicit hash → setSession
  | { kind: 'error'; error: string; description: string | null } // ?error=access_denied 등
  | { kind: 'none' }; // 인증 콜백 아님(무해)

/**
 * `#` 뒤의 hash fragment를 URLSearchParams로 파싱한다. 선행 `#`는 제거.
 * hash가 비면 빈 params.
 */
function hashParams(url: URL): URLSearchParams {
  const raw = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  return new URLSearchParams(raw);
}

/**
 * 딥링크로 열린 URL을 인증 콜백으로 판별한다.
 *
 * 우선순위: error > code > tokens > none.
 * - error: query 또는 hash의 `error`(+`error_description`). 사용자 취소·거부.
 * - code: query `?code=` (에러 없을 때). exchangeCodeForSession 대상.
 * - tokens: `access_token` && `refresh_token`(hash 우선, query 폴백). setSession 대상.
 * - none: 위 어느 것도 아님(스킴만 열림 등) — 호출자는 무시.
 *
 * 잘못된 URL 문자열이어도 throw하지 않고 { kind:'none' } 반환(방어적).
 */
export function parseAuthCallback(rawUrl: string): AuthCallback {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: 'none' };
  }

  const query = url.searchParams;
  const hash = hashParams(url);

  // 1) error (query 또는 hash) — 최우선
  const error = query.get('error') ?? hash.get('error');
  if (error) {
    const description =
      query.get('error_description') ?? hash.get('error_description');
    return { kind: 'error', error, description: description ?? null };
  }

  // 2) code (query)
  const code = query.get('code');
  if (code) {
    return { kind: 'code', code };
  }

  // 3) tokens (hash 우선, query 폴백) — 둘 다 있어야 유효
  const accessToken = hash.get('access_token') ?? query.get('access_token');
  const refreshToken = hash.get('refresh_token') ?? query.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'tokens', accessToken, refreshToken };
  }

  // 4) 그 외
  return { kind: 'none' };
}
