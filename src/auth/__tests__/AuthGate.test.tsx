import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

/**
 * AuthGate 상태 머신 테스트 (PR④ §5.2 — 7 케이스).
 * AuthProvider를 실제로 마운트하고 `../lib/supabase`만 mock하여
 * getSession / onAuthStateChange / local-mode 분기를 통합 검증한다.
 */

type AuthCb = (event: string, session: unknown) => void;

const onAuthCb = { current: null as AuthCb | null };
const unsubscribe = vi.fn();

const authMock = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn((cb: AuthCb) => {
    onAuthCb.current = cb;
    return { data: { subscription: { unsubscribe } } };
  }),
  signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
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

import { AuthProvider } from '../AuthProvider';
import { AuthGate } from '../AuthGate';
import { ko } from '../../i18n/strings';

const CHILD = <div data-testid="app-children">APP</div>;

function renderGate() {
  return render(
    <AuthProvider>
      <AuthGate>{CHILD}</AuthGate>
    </AuthProvider>,
  );
}

/** 미결 Promise — loading 상태를 붙잡는다. */
function pendingSession() {
  authMock.getSession.mockReturnValue(new Promise(() => {}));
}

beforeEach(() => {
  vi.clearAllMocks();
  onAuthCb.current = null;
  supabaseState.supabase = { auth: authMock };
  supabaseState.isSupabaseConfigured = true;
  authMock.getSession.mockResolvedValue({ data: { session: null } });
});

describe('AuthGate — configured branches', () => {
  it('1. loading → AuthSplash, no LoginScreen/children', () => {
    pendingSession();
    renderGate();
    expect(screen.getByText(ko.loginLoading)).toBeInTheDocument();
    expect(screen.queryByTestId('app-children')).toBeNull();
    expect(
      screen.queryByRole('button', { name: ko.loginGoogle }),
    ).toBeNull();
  });

  it('2. unauthenticated → LoginScreen, children absent (AC④-1)', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    renderGate();
    expect(
      await screen.findByRole('button', { name: ko.loginGoogle }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('app-children')).toBeNull();
  });

  it('3. authenticated (initial session) → children, no LoginScreen (AC④-2/3)', async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });
    renderGate();
    expect(await screen.findByTestId('app-children')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: ko.loginGoogle }),
    ).toBeNull();
  });

  it('4. SIGNED_IN transition → children (B2-b)', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    renderGate();
    await screen.findByRole('button', { name: ko.loginGoogle });
    act(() => onAuthCb.current?.('SIGNED_IN', { user: { id: 'u1' } }));
    expect(await screen.findByTestId('app-children')).toBeInTheDocument();
  });

  it('5. SIGNED_OUT transition → LoginScreen returns (B2-b)', async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });
    renderGate();
    await screen.findByTestId('app-children');
    act(() => onAuthCb.current?.('SIGNED_OUT', null));
    expect(
      await screen.findByRole('button', { name: ko.loginGoogle }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('app-children')).toBeNull();
  });
});

describe('AuthGate — local-mode (AC④-7 · anti-brick)', () => {
  beforeEach(() => {
    supabaseState.supabase = null;
    supabaseState.isSupabaseConfigured = false;
  });

  it('6. children render immediately, no LoginScreen, auth never called', () => {
    renderGate();
    expect(screen.getByTestId('app-children')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: ko.loginGoogle }),
    ).toBeNull();
    expect(authMock.getSession).not.toHaveBeenCalled();
    expect(authMock.onAuthStateChange).not.toHaveBeenCalled();
  });
});

describe('AuthGate — subscription cleanup (AC④-9)', () => {
  it('7. unsubscribes on unmount', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    const { unmount } = renderGate();
    await waitFor(() => expect(authMock.onAuthStateChange).toHaveBeenCalled());
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
