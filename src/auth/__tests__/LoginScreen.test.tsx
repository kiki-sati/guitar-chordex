import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * LoginScreen 테스트 (PR④ §5.3 — 5 케이스).
 * useAuth 메서드만 mock하여 LoginScreen이 SDK를 직접 호출하지 않고
 * 컨텍스트 메서드를 정확한 인자/타이밍으로 호출하는지 검증한다.
 */

const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
const signInWithApple = vi.fn().mockResolvedValue(undefined);
const signInWithEmail = vi.fn().mockResolvedValue({ error: null });

vi.mock('../AuthProvider', () => ({
  useAuth: () => ({
    status: 'unauthenticated' as const,
    session: null,
    loading: false,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signOut: vi.fn(),
  }),
}));

import { LoginScreen } from '../LoginScreen';
import { ko } from '../../i18n/strings';

beforeEach(() => {
  vi.clearAllMocks();
  signInWithEmail.mockResolvedValue({ error: null });
});

describe('LoginScreen', () => {
  it('1. Google button click calls signInWithGoogle once (AC④-4)', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole('button', { name: ko.loginGoogle }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('2. Apple button click calls signInWithApple once', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole('button', { name: ko.loginApple }));
    expect(signInWithApple).toHaveBeenCalledTimes(1);
  });

  it('3a. empty email submit → does NOT call signInWithEmail + shows alert', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole('button', { name: ko.loginEmailSubmit }));
    expect(signInWithEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(ko.loginEmailInvalid);
  });

  it('3b. malformed email (no @) → does NOT call + alert', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByLabelText(ko.loginEmailLabel), 'notanemail');
    await user.click(screen.getByRole('button', { name: ko.loginEmailSubmit }));
    expect(signInWithEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(ko.loginEmailInvalid);
  });

  it('4. valid email submit → calls signInWithEmail + shows sent notice (AC④-5)', async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByLabelText(ko.loginEmailLabel), 'a@b.com');
    await user.click(screen.getByRole('button', { name: ko.loginEmailSubmit }));
    expect(signInWithEmail).toHaveBeenCalledTimes(1);
    expect(signInWithEmail).toHaveBeenCalledWith('a@b.com');
    expect(await screen.findByText(ko.loginEmailSent)).toBeInTheDocument();
  });

  it('5. OTP returns error → shows error message', async () => {
    signInWithEmail.mockResolvedValue({ error: new Error('boom') });
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByLabelText(ko.loginEmailLabel), 'a@b.com');
    await user.click(screen.getByRole('button', { name: ko.loginEmailSubmit }));
    expect(await screen.findByText(ko.loginEmailError)).toBeInTheDocument();
  });
});
