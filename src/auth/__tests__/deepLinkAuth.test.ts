import { describe, it, expect } from 'vitest';
import { parseAuthCallback, type AuthCallback } from '../deepLinkAuth';

/**
 * 딥링크 콜백 파서 골든 케이스 (설계 §부록 · N1).
 * 순수 문자열 함수 — React·Capacitor·supabase 무의존. 우선순위 error > code > tokens > none.
 * 잘못된 URL은 throw 없이 { kind:'none' }.
 */
describe('parseAuthCallback', () => {
  it('case 1: PKCE code in query → { kind:"code" }', () => {
    const out: AuthCallback = parseAuthCallback(
      'com.chordsalon.app://auth-callback?code=abc123',
    );
    expect(out).toEqual({ kind: 'code', code: 'abc123' });
  });

  it('case 2: implicit tokens in hash → { kind:"tokens" }', () => {
    const out = parseAuthCallback(
      'com.chordsalon.app://auth-callback#access_token=AT&refresh_token=RT&token_type=bearer',
    );
    expect(out).toEqual({
      kind: 'tokens',
      accessToken: 'AT',
      refreshToken: 'RT',
    });
  });

  it('case 3: error+error_description in query → { kind:"error" }', () => {
    const out = parseAuthCallback(
      'com.chordsalon.app://auth-callback?error=access_denied&error_description=User+cancelled',
    );
    expect(out).toEqual({
      kind: 'error',
      error: 'access_denied',
      description: 'User cancelled',
    });
  });

  it('case 4: bare scheme with no params → { kind:"none" }', () => {
    expect(parseAuthCallback('com.chordsalon.app://auth-callback')).toEqual({
      kind: 'none',
    });
  });

  it('case 5: unrelated https url with no auth params → { kind:"none" }', () => {
    expect(parseAuthCallback('https://example.com/other?foo=bar')).toEqual({
      kind: 'none',
    });
  });

  it('case 6: invalid url string → { kind:"none" } (no throw)', () => {
    expect(() => parseAuthCallback('not a url')).not.toThrow();
    expect(parseAuthCallback('not a url')).toEqual({ kind: 'none' });
  });

  it('case 7: code and error together → error wins (priority)', () => {
    const out = parseAuthCallback(
      'com.chordsalon.app://auth-callback?code=abc123&error=access_denied',
    );
    expect(out).toEqual({
      kind: 'error',
      error: 'access_denied',
      description: null,
    });
  });

  it('case 8: error inside hash → { kind:"error" }', () => {
    const out = parseAuthCallback(
      'com.chordsalon.app://auth-callback#error=server_error&error_description=boom',
    );
    expect(out).toEqual({
      kind: 'error',
      error: 'server_error',
      description: 'boom',
    });
  });

  it('extracts error with null description when error_description absent', () => {
    expect(
      parseAuthCallback('com.chordsalon.app://auth-callback?error=access_denied'),
    ).toEqual({ kind: 'error', error: 'access_denied', description: null });
  });

  it('code takes precedence over tokens when both present (no error)', () => {
    const out = parseAuthCallback(
      'com.chordsalon.app://auth-callback?code=C#access_token=AT&refresh_token=RT',
    );
    expect(out).toEqual({ kind: 'code', code: 'C' });
  });

  it('tokens require BOTH access_token and refresh_token (only access → none)', () => {
    expect(
      parseAuthCallback('com.chordsalon.app://auth-callback#access_token=AT'),
    ).toEqual({ kind: 'none' });
  });

  it('falls back to query for tokens when hash absent', () => {
    const out = parseAuthCallback(
      'com.chordsalon.app://auth-callback?access_token=AT&refresh_token=RT',
    );
    expect(out).toEqual({
      kind: 'tokens',
      accessToken: 'AT',
      refreshToken: 'RT',
    });
  });

  it('empty string → { kind:"none" }', () => {
    expect(parseAuthCallback('')).toEqual({ kind: 'none' });
  });
});
