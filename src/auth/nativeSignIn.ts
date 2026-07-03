/**
 * 네이티브 sign-in 어댑터 (설계 §2.2). 네이티브에서만 호출(가드는 AuthProvider가).
 *
 * 플러그인을 동적 import()로 로드해 웹 초기 청크에서 격리한다. 반환은 플러그인
 * 무관 정규화 토큰(NativeIdToken). supabase 접근은 하지 않는다 — AuthProvider가
 * 반환된 토큰을 supabase.auth.signInWithIdToken(...)에 넘긴다(계층 분리).
 *
 * Apple: raw nonce를 SHA-256 해시해 authorize에 전달하고, 정규화 반환에는
 *   raw nonce를 담는다(supabase가 raw nonce를 해시해 idToken의 nonce 클레임과 대조).
 * Google(capgo): initialize 후 login. nonce는 raw nonce를 그대로 전달·반환.
 */

/** 네이티브 시트가 반환하는 최소 토큰 계약(플러그인 무관 정규화). */
export interface NativeIdToken {
  idToken: string;
  /** raw nonce(해시 전) — signInWithIdToken({ nonce })에 필요. */
  nonce?: string;
}

// ── 설정(콘솔에서 발급, env 주입) ─────────────────────────────────
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID ?? '';
const APPLE_REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI ?? '';
const GOOGLE_IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;

/** 암호학적 랜덤 nonce(hex). WebView/Node webcrypto 공통. */
function randomNonce(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** raw nonce의 SHA-256 hex 해시(Apple authorize 전달용). */
async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** Apple 네이티브 시트 → identityToken(+raw nonce). 실패/취소는 throw. */
export async function appleNativeIdToken(): Promise<NativeIdToken> {
  const { SignInWithApple } = await import(
    '@capacitor-community/apple-sign-in'
  );
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  const { response } = await SignInWithApple.authorize({
    clientId: APPLE_CLIENT_ID,
    redirectURI: APPLE_REDIRECT_URI,
    scopes: 'email name',
    nonce: hashedNonce,
  });

  if (!response.identityToken) {
    throw new Error('Apple sign-in returned no identityToken');
  }
  return { idToken: response.identityToken, nonce: rawNonce };
}

/** Google 네이티브 시트 → idToken(+raw nonce). 실패/취소는 throw. */
export async function googleNativeIdToken(): Promise<NativeIdToken> {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  const rawNonce = randomNonce();

  await SocialLogin.initialize({
    google: {
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      webClientId: GOOGLE_WEB_CLIENT_ID,
    },
  });

  const { result } = await SocialLogin.login({
    provider: 'google',
    options: { nonce: rawNonce },
  });

  // 온라인 응답만 idToken을 갖는다(offline은 serverAuthCode만).
  if (result.responseType !== 'online' || !result.idToken) {
    throw new Error('Google sign-in returned no idToken');
  }
  return { idToken: result.idToken, nonce: rawNonce };
}
