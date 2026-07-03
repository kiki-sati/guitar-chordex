import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 네이티브 sign-in 어댑터 (설계 §2.2). 플러그인을 동적 import()로 로드하고
 * idToken(+Apple raw nonce)을 정규화한다. supabase·React 무의존.
 *
 * 플러그인은 vi.mock으로 대체(실제 네이티브 호출 0). Apple은 raw nonce를 SHA-256
 * 해시해 authorize에 넘기고, 정규화 반환에는 raw nonce를 담는다.
 */

// ── Apple 플러그인 mock ──────────────────────────────────────────
const appleAuthorize = vi.fn();
vi.mock('@capacitor-community/apple-sign-in', () => ({
  SignInWithApple: {
    authorize: (...a: unknown[]) => appleAuthorize(...a),
  },
}));

// ── Google(capgo) 플러그인 mock ──────────────────────────────────
const socialInitialize = vi.fn();
const socialLogin = vi.fn();
vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: (...a: unknown[]) => socialInitialize(...a),
    login: (...a: unknown[]) => socialLogin(...a),
  },
}));

import { appleNativeIdToken, googleNativeIdToken } from '../nativeSignIn';

beforeEach(() => {
  vi.clearAllMocks();
  appleAuthorize.mockResolvedValue({
    response: {
      user: 'apple-user',
      email: null,
      givenName: null,
      familyName: null,
      identityToken: 'APPLE_ID_TOKEN',
      authorizationCode: 'APPLE_CODE',
    },
  });
  socialInitialize.mockResolvedValue(undefined);
  socialLogin.mockResolvedValue({
    provider: 'google',
    result: {
      accessToken: null,
      idToken: 'GOOGLE_ID_TOKEN',
      profile: {
        email: 'x@y.com',
        familyName: null,
        givenName: null,
        id: 'gid',
        name: null,
        imageUrl: null,
      },
      responseType: 'online',
    },
  });
});

describe('appleNativeIdToken', () => {
  it('returns identityToken and a raw nonce', async () => {
    const out = await appleNativeIdToken();
    expect(out.idToken).toBe('APPLE_ID_TOKEN');
    expect(typeof out.nonce).toBe('string');
    expect(out.nonce && out.nonce.length).toBeGreaterThan(0);
  });

  it('calls authorize with a HASHED nonce (not the raw nonce)', async () => {
    const out = await appleNativeIdToken();
    expect(appleAuthorize).toHaveBeenCalledTimes(1);
    const arg = appleAuthorize.mock.calls[0][0] as { nonce?: string };
    expect(typeof arg.nonce).toBe('string');
    // 넘긴 nonce는 raw nonce가 아니라 그 해시여야 한다.
    expect(arg.nonce).not.toBe(out.nonce);
  });

  it('propagates (throws) when the native sheet is cancelled', async () => {
    appleAuthorize.mockRejectedValueOnce(new Error('cancelled'));
    await expect(appleNativeIdToken()).rejects.toThrow('cancelled');
  });

  it('throws when identityToken is missing', async () => {
    appleAuthorize.mockResolvedValueOnce({
      response: { identityToken: '', authorizationCode: 'c' },
    });
    await expect(appleNativeIdToken()).rejects.toThrow();
  });
});

describe('googleNativeIdToken', () => {
  it('initializes then logs in and returns idToken', async () => {
    const out = await googleNativeIdToken();
    expect(socialInitialize).toHaveBeenCalledTimes(1);
    expect(socialLogin).toHaveBeenCalledTimes(1);
    const loginArg = socialLogin.mock.calls[0][0] as { provider?: string };
    expect(loginArg.provider).toBe('google');
    expect(out.idToken).toBe('GOOGLE_ID_TOKEN');
  });

  it('passes the raw nonce to login and returns the same nonce', async () => {
    const out = await googleNativeIdToken();
    const loginArg = socialLogin.mock.calls[0][0] as {
      options?: { nonce?: string };
    };
    expect(loginArg.options?.nonce).toBe(out.nonce);
  });

  it('propagates (throws) when the native sheet is cancelled', async () => {
    socialLogin.mockRejectedValueOnce(new Error('USER_CANCELLED'));
    await expect(googleNativeIdToken()).rejects.toThrow('USER_CANCELLED');
  });

  it('throws when the online response has no idToken', async () => {
    socialLogin.mockResolvedValueOnce({
      provider: 'google',
      result: { serverAuthCode: 'x', responseType: 'offline' },
    });
    await expect(googleNativeIdToken()).rejects.toThrow();
  });
});
