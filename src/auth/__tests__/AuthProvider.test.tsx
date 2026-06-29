import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

/**
 * AuthProvider 단위 테스트 (PR④ · B2 + 메서드 계약).
 * `../lib/supabase` 모듈을 통째로 mock하여 supabase.auth / isSupabaseConfigured를
 * 테스트별로 주입한다(헤르메틱 — 실제 SDK/네트워크 0).
 */

// ── mockable supabase.auth ───────────────────────────────────────────
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

// import after mock registration
import { AuthProvider, useAuth } from '../AuthProvider';

const ORIGIN = window.location.origin;

/** 컨텍스트 값을 화면에 노출하는 프로브. */
function Probe() {
  const { status, signInWithGoogle, signInWithApple, signInWithEmail, signOut } =
    useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <button onClick={() => void signInWithGoogle()}>g</button>
      <button onClick={() => void signInWithApple()}>a</button>
      <button onClick={() => void signInWithEmail('x@y.com')}>e</button>
      <button onClick={() => void signOut()}>o</button>
    </div>
  );
}

function renderProvider(children: ReactNode = <Probe />) {
  return render(<AuthProvider>{children}</AuthProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  onAuthCb.current = null;
  supabaseState.supabase = { auth: authMock };
  supabaseState.isSupabaseConfigured = true;
  authMock.getSession.mockResolvedValue({ data: { session: null } });
  authMock.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  authMock.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  authMock.signOut.mockResolvedValue({ error: null });
});

describe('AuthProvider — configured', () => {
  it('starts in loading, then resolves to unauthenticated when no session', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    renderProvider();
    // 첫 렌더는 loading
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
  });

  it('resolves to authenticated when getSession returns a session (B2-a)', async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1' } } },
    });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('authenticated'),
    );
  });

  it('subscribes to onAuthStateChange and transitions on SIGNED_IN (B2-b)', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'),
    );
    expect(authMock.onAuthStateChange).toHaveBeenCalled();
    act(() => {
      onAuthCb.current?.('SIGNED_IN', { user: { id: 'u1' } });
    });
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('authenticated'),
    );
  });

  it('unsubscribes on unmount (AC④-9)', async () => {
    const { unmount } = renderProvider();
    await waitFor(() => expect(authMock.onAuthStateChange).toHaveBeenCalled());
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('signInWithGoogle delegates with redirectTo origin (AC④-4)', async () => {
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status')).not.toHaveTextContent('loading'),
    );
    await user.click(screen.getByText('g'));
    expect(authMock.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: ORIGIN },
    });
  });

  it('signInWithApple delegates provider apple', async () => {
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status')).not.toHaveTextContent('loading'),
    );
    await user.click(screen.getByText('a'));
    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: ORIGIN },
    });
  });

  it('signInWithEmail delegates with emailRedirectTo origin (AC④-5)', async () => {
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status')).not.toHaveTextContent('loading'),
    );
    await user.click(screen.getByText('e'));
    expect(authMock.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(authMock.signInWithOtp).toHaveBeenCalledWith({
      email: 'x@y.com',
      options: { emailRedirectTo: ORIGIN },
    });
  });

  it('signOut delegates to supabase.auth.signOut (AC④-6)', async () => {
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() =>
      expect(screen.getByTestId('status')).not.toHaveTextContent('loading'),
    );
    await user.click(screen.getByText('o'));
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('AuthProvider — local-mode (isSupabaseConfigured=false, supabase=null)', () => {
  beforeEach(() => {
    supabaseState.supabase = null;
    supabaseState.isSupabaseConfigured = false;
  });

  it('status is local-mode and supabase.auth is never touched (AC④-7)', async () => {
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('local-mode');
    expect(authMock.getSession).not.toHaveBeenCalled();
    expect(authMock.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('methods are no-ops and do not throw / do not dereference null', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByText('g'));
    await user.click(screen.getByText('e'));
    await user.click(screen.getByText('o'));
    expect(authMock.signInWithOAuth).not.toHaveBeenCalled();
    expect(authMock.signInWithOtp).not.toHaveBeenCalled();
    expect(authMock.signOut).not.toHaveBeenCalled();
  });
});

describe('useAuth — outside provider (lenient fallback, §3.3-A)', () => {
  it('returns a local-mode default instead of throwing', () => {
    function Bare() {
      const { status } = useAuth();
      return <div data-testid="bare-status">{status}</div>;
    }
    render(<Bare />);
    expect(screen.getByTestId('bare-status')).toHaveTextContent('local-mode');
  });
});
