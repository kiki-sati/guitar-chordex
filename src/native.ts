import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';
import { parseAuthCallback } from './auth/deepLinkAuth';

/**
 * 딥링크/appState 리스너 중복 등록 가드 (R5).
 * initNative는 앱당 1회(main.tsx) 호출이 원칙이나 HMR/재마운트 방어.
 */
let authListenersRegistered = false;

/**
 * 딥링크로 열린 URL을 인증 콜백으로 처리한다.
 * 파서(순수)로 판별 후, 결과별로 supabase 세션 교환을 수행한다(supabase 소유).
 * 폴백 브라우저가 떠 있었다면 닫는다.
 */
async function handleAuthDeepLink(url: string): Promise<void> {
  if (!supabase) return; // local-mode no-op (안티-브릭)
  const result = parseAuthCallback(url);
  switch (result.kind) {
    case 'code':
      await supabase.auth.exchangeCodeForSession(result.code);
      break;
    case 'tokens':
      await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      break;
    case 'error':
      // 사용자 취소·거부 — 세션 변경 없음. 로깅만.
      console.warn('[auth] deep-link error:', result.error, result.description);
      break;
    case 'none':
      // 인증 콜백 아님 — 무시.
      return;
  }
  // code/tokens/error 모두: 폴백 브라우저가 떠 있으면 닫는다.
  try {
    await Browser.close();
  } catch {
    /* 브라우저가 없었으면 무시 */
  }
}

/** 딥링크·appState 리스너 등록(네이티브 전용, 1회). */
function registerAuthListeners(): void {
  if (authListenersRegistered) return;
  authListenersRegistered = true;

  void App.addListener('appUrlOpen', ({ url }) => {
    void handleAuthDeepLink(url);
  });

  void App.addListener('appStateChange', ({ isActive }) => {
    if (!supabase) return; // local-mode no-op
    if (isActive) {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

/**
 * 네이티브(Capacitor) 플랫폼에서만 동작하는 초기화.
 * 웹에서는 즉시 반환하므로 브라우저 빌드에 영향 없음.
 */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // 딥링크(OAuth 콜백)·앱 상태 변화(토큰 자동 갱신) 리스너 등록.
  registerAuthListeners();

  try {
    // 흰 배경 앱 → 상태바를 웹뷰 위에 겹치지 않게, 어두운 아이콘으로
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    }
  } catch {
    /* 일부 기기/환경에서 StatusBar 미지원 — 무시 */
  }

  try {
    await SplashScreen.hide();
  } catch {
    /* noop */
  }
}
