import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Sidebar 로그아웃 테스트 (PR④ §5.4).
 * - useApp: 사이드바가 의존하는 앱 상태(grass)만 최소 stub.
 * - useAuth: status/signOut을 테스트별로 주입.
 */

const signOut = vi.fn().mockResolvedValue(undefined);
const authState = { status: 'authenticated' as string };

vi.mock('../../state/AppContext', () => ({
  useApp: () => ({
    state: { grass: {}, view: 'home' },
    dispatch: vi.fn(),
  }),
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    status: authState.status,
    session: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signInWithApple: vi.fn(),
    signInWithEmail: vi.fn(),
    signOut,
  }),
}));

import { Sidebar } from '../Sidebar';
import { ko } from '../../i18n/strings';

beforeEach(() => {
  vi.clearAllMocks();
  authState.status = 'authenticated';
});

describe('Sidebar — logout control (PR④)', () => {
  it('authenticated → logout button visible, click calls signOut once (AC④-6)', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    const btn = screen.getByRole('button', { name: ko.logout });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('local-mode → logout button NOT rendered', () => {
    authState.status = 'local-mode';
    render(<Sidebar />);
    expect(screen.queryByRole('button', { name: ko.logout })).toBeNull();
  });
});
