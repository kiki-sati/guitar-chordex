import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * AuthProvider 플랫폼 분기 (N2 · AC-5/6/7/8).
 * 4경로 검증:
 *   web-configured        → signInWithOAuth (기존 경로, 회귀 0)
 *   native-apple          → appleNativeIdToken → signInWithIdToken({provider:'apple', nonce})
 *   native-google         → googleNativeIdToken → signInWithIdToken({provider:'google'})
 *   local-mode(!supabase) → no-op (네이티브여도)
 */

// ── 플랫폼 mock ──────────────────────────────────────────────────
const platform = { native: false };
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native },
}));

// ── 네이티브 어댑터 mock ─────────────────────────────────────────
const appleNativeIdToken = vi.fn();
const googleNativeIdToken = vi.fn();
vi.mock('../nativeSignIn', () => ({
  appleNativeIdToken: () => appleNativeIdToken(),
  googleNativeIdToken: () => googleNativeIdToken(),
}));

// ── supabase mock ────────────────────────────────────────────────
type AuthCb = (event: string, session: unknown) => void;
const authMock = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn((_cb: AuthCb) => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithIdToken: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
};
const supabaseState = {
  supabase: { auth: authMock } as { auth: typeof authMock } | null,
  isSupabaseConfigured: true,
};
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return supabaseState.supabase;
  },
  get isSupabaseConfigured() {
    return supabaseState.isSupabaseConfigured;
  },
}));

import { AuthProvider, useAuth } from '../AuthProvider';

function Probe() {
  const { status, signInWithGoogle, signInWithApple } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <button onClick={() => void signInWithGoogle()}>g</button>
      <button onClick={() => void signInWithApple()}>a</button>
    </div>
  );
}

async function renderReady() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId('status')).not.toHaveTextContent('loading'),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  platform.native = false;
  supabaseState.supabase = { auth: authMock };
  supabaseState.isSupabaseConfigured = true;
  authMock.getSession.mockResolvedValue({ data: { session: null } });
  authMock.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  authMock.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
  appleNativeIdToken.mockResolvedValue({
    idToken: 'APPLE_TOKEN',
    nonce: 'RAW_NONCE',
  });
  googleNativeIdToken.mockResolvedValue({ idToken: 'GOOGLE_TOKEN' });
});

describe('web (isNativePlatform=false) — existing OAuth path (AC-5)', () => {
  it('signInWithGoogle uses signInWithOAuth, never signInWithIdToken', async () => {
    const user = userEvent.setup();
    await renderReady();
    await user.click(screen.getByText('g'));
    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    expect(authMock.signInWithIdToken).not.toHaveBeenCalled();
    expect(googleNativeIdToken).not.toHaveBeenCalled();
  });

  it('signInWithApple uses signInWithOAuth on web', async () => {
    const user = userEvent.setup();
    await renderReady();
    await user.click(screen.getByText('a'));
    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    });
    expect(authMock.signInWithIdToken).not.toHaveBeenCalled();
    expect(appleNativeIdToken).not.toHaveBeenCalled();
  });
});

describe('native (isNativePlatform=true) — idToken path (AC-6/7)', () => {
  beforeEach(() => {
    platform.native = true;
  });

  it('signInWithApple → appleNativeIdToken → signInWithIdToken with nonce', async () => {
    const user = userEvent.setup();
    await renderReady();
    await user.click(screen.getByText('a'));
    await waitFor(() =>
      expect(appleNativeIdToken).toHaveBeenCalledTimes(1),
    );
    expect(authMock.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'APPLE_TOKEN',
      nonce: 'RAW_NONCE',
    });
    expect(authMock.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('signInWithGoogle → googleNativeIdToken → signInWithIdToken (no nonce)', async () => {
    const user = userEvent.setup();
    await renderReady();
    await user.click(screen.getByText('g'));
    await waitFor(() =>
      expect(googleNativeIdToken).toHaveBeenCalledTimes(1),
    );
    expect(authMock.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'GOOGLE_TOKEN',
      nonce: undefined,
    });
    expect(authMock.signInWithOAuth).not.toHaveBeenCalled();
  });
});

describe('local-mode (!supabase) — no-op even on native (AC-8)', () => {
  beforeEach(() => {
    platform.native = true;
    supabaseState.supabase = null;
    supabaseState.isSupabaseConfigured = false;
  });

  it('native sign-in is a no-op: no adapter, no idToken call', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId('status')).toHaveTextContent('local-mode');
    await user.click(screen.getByText('a'));
    await user.click(screen.getByText('g'));
    expect(appleNativeIdToken).not.toHaveBeenCalled();
    expect(googleNativeIdToken).not.toHaveBeenCalled();
    expect(authMock.signInWithIdToken).not.toHaveBeenCalled();
    expect(authMock.signInWithOAuth).not.toHaveBeenCalled();
  });
});
