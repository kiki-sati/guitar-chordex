import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { appleNativeIdToken, googleNativeIdToken } from './nativeSignIn';
import { clearUserCache } from '../state/user-keys';

export type AuthStatus =
  | 'loading' // getSession in-flight
  | 'unauthenticated' // configured, 세션 없음
  | 'authenticated' // configured, 세션 있음
  | 'local-mode'; // isSupabaseConfigured === false (env 없음)

export interface AuthContextValue {
  status: AuthStatus;
  /** local-mode/unauthenticated에서는 null */
  session: Session | null;
  /** status === 'loading' 의 편의 별칭 */
  loading: boolean;
  /** OAuth 리다이렉트 시작. local-mode/null client에서는 no-op. */
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** 매직링크 OTP 발송. 결과를 호출자가 UI로 처리. */
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider 부재 시 throw 대신 반환하는 관대한 기본값 (§3.3-A).
 * 기존 테스트(인증 mock 없음)와 test-utils.renderWithProvider가
 * 게이트를 거치지 않고도 회귀 0이 되도록 한다. local-mode = 로그아웃 버튼 미렌더.
 */
const LOCAL_MODE_DEFAULT: AuthContextValue = {
  status: 'local-mode',
  session: null,
  loading: false,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signOut: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? 'loading' : 'local-mode',
  );
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // 로컬 모드: supabase가 null이므로 auth API를 절대 건드리지 않는다 (AC④-7).
    if (!isSupabaseConfigured || !supabase) return;

    let active = true;
    // onAuthStateChange가 먼저 발화하면, 늦게 resolve되는 getSession 결과로
    // 더 최신 세션 상태를 덮어쓰지 않는다(순서 역전 레이스 차단 — getSession은
    // loading→초기 1회 확정 용도, 이후 전이는 구독이 소유).
    let settledByEvent = false;
    const client = supabase;

    void client.auth.getSession().then(({ data }) => {
      if (!active || settledByEvent) return;
      const s = data.session ?? null;
      setSession(s);
      setStatus(s ? 'authenticated' : 'unauthenticated');
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      settledByEvent = true;
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const origin = window.location.origin;
    return {
      status,
      session,
      loading: status === 'loading',
      signInWithGoogle: async () => {
        if (!supabase) return; // local-mode no-op (AC-8)
        if (Capacitor.isNativePlatform()) {
          // 네이티브: 시트 어댑터 → idToken → signInWithIdToken.
          const { idToken, nonce } = await googleNativeIdToken();
          await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
            nonce,
          });
          return;
        }
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: origin },
        });
      },
      signInWithApple: async () => {
        if (!supabase) return; // local-mode no-op (AC-8)
        if (Capacitor.isNativePlatform()) {
          // 네이티브: Apple raw nonce를 signInWithIdToken에 함께 전달.
          const { idToken, nonce } = await appleNativeIdToken();
          await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: idToken,
            nonce,
          });
          return;
        }
        await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo: origin },
        });
      },
      signInWithEmail: async (email: string) => {
        if (!supabase) return { error: new Error('local mode') };
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: origin },
        });
        return { error: error ?? null };
      },
      signOut: async () => {
        if (!supabase) return;
        // 직전 로그인 uid를 signOut 전에 포착(이후 session이 null로 전이됨).
        const prevUid = session?.user?.id ?? null;
        await supabase.auth.signOut();
        // 공유기기 프라이버시(AC⑤-9): 이전 user의 캐시·큐를 물리 삭제.
        // legacy `cs_*`·다른 uid는 미영향 → 로컬 모드 회귀 0, 다계정 격리 유지.
        if (prevUid) clearUserCache(prevUid);
      },
    };
  }, [status, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 인증 컨텍스트 훅. useApp()과 달리 Provider 부재 시 throw하지 않고
 * local-mode 기본값을 반환한다(§3.3-A · 회귀 0 의도적 선택).
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  return ctx ?? LOCAL_MODE_DEFAULT;
}
