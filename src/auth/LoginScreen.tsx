import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { ko } from '../i18n/strings';
import styles from './LoginScreen.module.css';

type EmailStatus = 'idle' | 'sending' | 'sent' | 'error';

/** 단순 클라이언트 측 이메일 형식 검증(빈/`@` 누락 차단). 서버 검증의 대체가 아님. */
function isValidEmail(value: string): boolean {
  const v = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * 로그인 화면 — OAuth 버튼(Google/Apple) + 이메일 매직링크 폼.
 * 부수효과는 전부 useAuth() 메서드 경유(supabase 직접 호출 금지 — 계층 분리).
 */
export function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');

  async function onSubmitEmail(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setEmailStatus('error');
      return;
    }
    setEmailStatus('sending');
    const { error } = await signInWithEmail(email.trim());
    setEmailStatus(error ? 'error' : 'sent');
  }

  const invalid = emailStatus === 'error' && !isValidEmail(email);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brandRow}>
          <span className={styles.logo} aria-hidden="true">
            🎸
          </span>
          <span className={styles.brand}>{ko.loginTitle}</span>
        </div>
        <p className={styles.subtitle}>{ko.loginSubtitle}</p>

        <button
          type="button"
          className={styles.oauthBtn}
          onClick={() => void signInWithGoogle()}
        >
          {ko.loginGoogle}
        </button>
        <button
          type="button"
          className={styles.oauthBtn}
          onClick={() => void signInWithApple()}
        >
          {ko.loginApple}
        </button>

        <div className={styles.divider}>
          <span>{ko.loginEmailDivider}</span>
        </div>

        <form className={styles.form} onSubmit={onSubmitEmail} noValidate>
          <label className={styles.label} htmlFor="login-email">
            {ko.loginEmailLabel}
          </label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            value={email}
            placeholder={ko.loginEmailPlaceholder}
            aria-label={ko.loginEmailLabel}
            aria-invalid={invalid || undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailStatus !== 'idle') setEmailStatus('idle');
            }}
          />
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={emailStatus === 'sending'}
          >
            {emailStatus === 'sending' ? ko.loginEmailSending : ko.loginEmailSubmit}
          </button>
        </form>

        {emailStatus === 'error' && (
          <p className={styles.alert} role="alert">
            {invalid ? ko.loginEmailInvalid : ko.loginEmailError}
          </p>
        )}
        {emailStatus === 'sent' && (
          <p className={styles.notice} role="status">
            {ko.loginEmailSent}
          </p>
        )}
      </div>
    </div>
  );
}
