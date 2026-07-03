import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * native.ts 딥링크/appState 리스너 등록 (N4 · AC-13 · R5).
 *
 * initNative()는 이미 isNativePlatform() 가드로 시작한다. 네이티브에서:
 *  - App.addListener('appUrlOpen') 콜백이 parseAuthCallback 결과별로
 *    supabase exchangeCodeForSession / setSession / (error·none 무시)를 호출한다.
 *  - App.addListener('appStateChange') 콜백이 active면 startAutoRefresh,
 *    아니면 stopAutoRefresh를 호출한다.
 *  - 중복 등록 가드(R5): initNative 두 번 호출해도 리스너는 1회만.
 *
 * 모든 Capacitor 플러그인·supabase를 mock(실제 네이티브 0).
 */

const platform = { native: true };
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
    getPlatform: () => 'ios',
  },
}));

// StatusBar/SplashScreen — 부수효과 무시(no-op mock)
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setOverlaysWebView: vi.fn().mockResolvedValue(undefined),
    setStyle: vi.fn().mockResolvedValue(undefined),
    setBackgroundColor: vi.fn().mockResolvedValue(undefined),
  },
  Style: { Light: 'LIGHT', Dark: 'DARK' },
}));
vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: vi.fn().mockResolvedValue(undefined) },
}));

// App 리스너 mock — 등록된 콜백을 캡처
type UrlCb = (e: { url: string }) => void;
type StateCb = (s: { isActive: boolean }) => void;
const listeners = {
  appUrlOpen: [] as UrlCb[],
  appStateChange: [] as StateCb[],
};
const appAddListener = vi.fn(
  (event: string, cb: UrlCb | StateCb) => {
    if (event === 'appUrlOpen') listeners.appUrlOpen.push(cb as UrlCb);
    if (event === 'appStateChange')
      listeners.appStateChange.push(cb as StateCb);
    return Promise.resolve({ remove: vi.fn() });
  },
);
vi.mock('@capacitor/app', () => ({
  App: { addListener: (...a: unknown[]) => appAddListener(...(a as [string, UrlCb])) },
}));

// Browser.close mock
const browserClose = vi.fn().mockResolvedValue(undefined);
vi.mock('@capacitor/browser', () => ({
  Browser: { close: () => browserClose() },
}));

// supabase mock
const authMock = {
  exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
  setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
  startAutoRefresh: vi.fn().mockResolvedValue(undefined),
  stopAutoRefresh: vi.fn().mockResolvedValue(undefined),
};
const supabaseState = {
  supabase: { auth: authMock } as { auth: typeof authMock } | null,
};
vi.mock('../lib/supabase', () => ({
  get supabase() {
    return supabaseState.supabase;
  },
}));

async function loadNative() {
  vi.resetModules();
  return import('../native');
}

beforeEach(() => {
  vi.clearAllMocks();
  platform.native = true;
  listeners.appUrlOpen = [];
  listeners.appStateChange = [];
  supabaseState.supabase = { auth: authMock };
});

describe('initNative — listener registration', () => {
  it('registers appUrlOpen and appStateChange listeners on native', async () => {
    const { initNative } = await loadNative();
    await initNative();
    expect(appAddListener).toHaveBeenCalledWith(
      'appUrlOpen',
      expect.any(Function),
    );
    expect(appAddListener).toHaveBeenCalledWith(
      'appStateChange',
      expect.any(Function),
    );
  });

  it('does NOT register listeners on web (isNativePlatform=false)', async () => {
    platform.native = false;
    const { initNative } = await loadNative();
    await initNative();
    expect(appAddListener).not.toHaveBeenCalled();
  });

  it('is idempotent: calling initNative twice registers listeners once (R5)', async () => {
    const { initNative } = await loadNative();
    await initNative();
    await initNative();
    const urlOpenCalls = appAddListener.mock.calls.filter(
      (c) => c[0] === 'appUrlOpen',
    );
    const stateCalls = appAddListener.mock.calls.filter(
      (c) => c[0] === 'appStateChange',
    );
    expect(urlOpenCalls).toHaveLength(1);
    expect(stateCalls).toHaveLength(1);
  });
});

describe('appUrlOpen callback — exchanges per parseAuthCallback result', () => {
  it('code → exchangeCodeForSession(code) + Browser.close()', async () => {
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appUrlOpen[0]({
      url: 'com.chordsalon.app://auth-callback?code=abc123',
    });
    await Promise.resolve();
    expect(authMock.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(authMock.setSession).not.toHaveBeenCalled();
    expect(browserClose).toHaveBeenCalled();
  });

  it('tokens → setSession({access_token, refresh_token})', async () => {
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appUrlOpen[0]({
      url: 'com.chordsalon.app://auth-callback#access_token=AT&refresh_token=RT',
    });
    await Promise.resolve();
    expect(authMock.setSession).toHaveBeenCalledWith({
      access_token: 'AT',
      refresh_token: 'RT',
    });
    expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('error → no session call (logged/ignored)', async () => {
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appUrlOpen[0]({
      url: 'com.chordsalon.app://auth-callback?error=access_denied',
    });
    await Promise.resolve();
    expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(authMock.setSession).not.toHaveBeenCalled();
  });

  it('none → no session call, no crash', async () => {
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appUrlOpen[0]({
      url: 'com.chordsalon.app://auth-callback',
    });
    await Promise.resolve();
    expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(authMock.setSession).not.toHaveBeenCalled();
  });

  it('local-mode (!supabase) → callback is a no-op', async () => {
    supabaseState.supabase = null;
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appUrlOpen[0]({
      url: 'com.chordsalon.app://auth-callback?code=abc123',
    });
    await Promise.resolve();
    expect(authMock.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('appStateChange callback — toggles auto refresh (AC-13)', () => {
  it('active → startAutoRefresh', async () => {
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appStateChange[0]({ isActive: true });
    await Promise.resolve();
    expect(authMock.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(authMock.stopAutoRefresh).not.toHaveBeenCalled();
  });

  it('inactive → stopAutoRefresh', async () => {
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appStateChange[0]({ isActive: false });
    await Promise.resolve();
    expect(authMock.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(authMock.startAutoRefresh).not.toHaveBeenCalled();
  });

  it('local-mode (!supabase) → no refresh calls', async () => {
    supabaseState.supabase = null;
    const { initNative } = await loadNative();
    await initNative();
    await listeners.appStateChange[0]({ isActive: true });
    await Promise.resolve();
    expect(authMock.startAutoRefresh).not.toHaveBeenCalled();
  });
});
