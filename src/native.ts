import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * 네이티브(Capacitor) 플랫폼에서만 동작하는 초기화.
 * 웹에서는 즉시 반환하므로 브라우저 빌드에 영향 없음.
 */
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

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
