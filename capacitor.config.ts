import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chordsalon.app',
  appName: 'Chordex',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#0052cc',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },
  // ── 개발용 라이브 리로드 (옵션) ─────────────────────────────
  // 실기기/에뮬레이터에서 PC의 Vite dev 서버를 직접 보려면 아래 주석을 해제하고
  // <PC-LAN-IP>를 실제 IP로 바꾼 뒤 `npx cap run android` 하세요.
  // (배포 빌드 시에는 반드시 다시 주석 처리 — 번들된 dist를 써야 함.)
  // server: {
  //   url: 'http://<PC-LAN-IP>:5173',
  //   cleartext: true,
  // },
};

export default config;
