import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { LoginScreen } from './LoginScreen';
import { ko } from '../i18n/strings';
import styles from './AuthGate.module.css';

/** 세션 확인 중 로딩 스플래시 (토큰 기반 미니멀 — 디자인 시안 부재, 플랜 §2.2/§9-Q2). */
export function AuthSplash() {
  return (
    <div className={styles.splash} role="status" aria-live="polite">
      <span className={styles.logo} aria-hidden="true">
        🎸
      </span>
      <div className={styles.brand}>{ko.brand}</div>
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.loadingText}>{ko.loginLoading}</span>
    </div>
  );
}

/**
 * 인증 게이트 — `useAuth().status`만 읽는 순수 분기 컴포넌트(자체 effect 없음).
 *  - loading          → AuthSplash
 *  - unauthenticated  → LoginScreen
 *  - authenticated    → children
 *  - local-mode       → children (로그인 벽 없음 — AC④-7)
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <AuthSplash />;
  if (status === 'unauthenticated') return <LoginScreen />;
  return <>{children}</>; // authenticated | local-mode
}
