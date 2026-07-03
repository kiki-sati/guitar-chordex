import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

/**
 * net.ts 온라인 감지 (N3).
 *
 * 두 축을 검증한다:
 *  - 웹 폴백(기존 계약): navigator.onLine + window 'online'. 시그니처 불변.
 *  - 네이티브 고도화: @capacitor/network getStatus()(캐시) + addListener('networkStatusChange').
 *
 * net.ts는 모듈 로드 시점에 플랫폼/네트워크를 읽으므로, 시나리오마다
 * vi.resetModules() 후 mock을 재설정하고 동적 import한다(헤르메틱).
 */

// ── mock 제어 상태 ───────────────────────────────────────────────
type NetStatus = { connected: boolean; connectionType: string };
type NetListener = (s: NetStatus) => void;

const platform = { native: false };
const network = {
  status: { connected: true, connectionType: 'wifi' } as NetStatus,
  listeners: [] as NetListener[],
  getStatus: vi.fn(),
  addListener: vi.fn(),
};

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platform.native,
  },
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: (...args: unknown[]) => network.getStatus(...args),
    addListener: (...args: unknown[]) => network.addListener(...args),
  },
}));

function stubNavigatorOnline(value: boolean | undefined): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

/** net 모듈을 현재 mock 상태로 신선하게 로드한다. */
async function loadNet() {
  vi.resetModules();
  return import('../net');
}

beforeEach(() => {
  platform.native = false;
  network.status = { connected: true, connectionType: 'wifi' };
  network.listeners = [];
  network.getStatus.mockReset();
  network.addListener.mockReset();
  network.getStatus.mockImplementation(() => Promise.resolve(network.status));
  network.addListener.mockImplementation(
    (_event: string, cb: NetListener) => {
      network.listeners.push(cb);
      return Promise.resolve({ remove: () => {} });
    },
  );
});

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  });
});

// ══════════════════════ 웹 폴백 (기존 계약 유지) ══════════════════════
describe('web fallback — isOnline', () => {
  it('returns true when navigator.onLine is true', async () => {
    stubNavigatorOnline(true);
    const { isOnline } = await loadNet();
    expect(isOnline()).toBe(true);
  });

  it('returns false when navigator.onLine is false', async () => {
    stubNavigatorOnline(false);
    const { isOnline } = await loadNet();
    expect(isOnline()).toBe(false);
  });

  it('returns true (optimistic) when navigator.onLine is undefined', async () => {
    stubNavigatorOnline(undefined);
    const { isOnline } = await loadNet();
    expect(isOnline()).toBe(true);
  });

  it('does NOT touch @capacitor/network on web', async () => {
    const { isOnline } = await loadNet();
    isOnline();
    expect(network.getStatus).not.toHaveBeenCalled();
    expect(network.addListener).not.toHaveBeenCalled();
  });
});

describe('web fallback — onOnline', () => {
  it('invokes callback when an online event fires', async () => {
    const { onOnline } = await loadNet();
    const cb = vi.fn();
    const off = onOnline(cb);
    window.dispatchEvent(new Event('online'));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it('unsubscribes: callback not called after disposer runs', async () => {
    const { onOnline } = await loadNet();
    const cb = vi.fn();
    const off = onOnline(cb);
    off();
    window.dispatchEvent(new Event('online'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('disposer is idempotent (calling twice does not throw)', async () => {
    const { onOnline } = await loadNet();
    const cb = vi.fn();
    const off = onOnline(cb);
    off();
    expect(() => off()).not.toThrow();
  });
});

// ══════════════════════ 네이티브 감지 ══════════════════════
describe('native — isOnline uses cached @capacitor/network status', () => {
  it('registers getStatus + networkStatusChange listener at module load', async () => {
    platform.native = true;
    await loadNet();
    expect(network.getStatus).toHaveBeenCalledTimes(1);
    expect(network.addListener).toHaveBeenCalledWith(
      'networkStatusChange',
      expect.any(Function),
    );
  });

  it('returns true optimistically before getStatus resolves', async () => {
    platform.native = true;
    // getStatus never resolves this test
    network.getStatus.mockImplementation(() => new Promise<NetStatus>(() => {}));
    const { isOnline } = await loadNet();
    expect(isOnline()).toBe(true);
  });

  it('reflects cached status once getStatus resolves', async () => {
    platform.native = true;
    network.status = { connected: false, connectionType: 'none' };
    const { isOnline } = await loadNet();
    // let the getStatus microtask settle
    await Promise.resolve();
    await Promise.resolve();
    expect(isOnline()).toBe(false);
  });

  it('updates cache when networkStatusChange fires', async () => {
    platform.native = true;
    network.status = { connected: true, connectionType: 'wifi' };
    const { isOnline } = await loadNet();
    await Promise.resolve();
    await Promise.resolve();
    expect(isOnline()).toBe(true);
    // simulate going offline
    network.listeners.forEach((l) =>
      l({ connected: false, connectionType: 'none' }),
    );
    expect(isOnline()).toBe(false);
  });
});

describe('native — onOnline fires on connected:true transition', () => {
  it('invokes cb when network transitions to connected', async () => {
    platform.native = true;
    network.status = { connected: false, connectionType: 'none' };
    const { onOnline } = await loadNet();
    await Promise.resolve();
    await Promise.resolve();
    const cb = vi.fn();
    const off = onOnline(cb);
    // offline → online transition
    network.listeners.forEach((l) =>
      l({ connected: true, connectionType: 'wifi' }),
    );
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it('does not invoke cb on a disconnect event', async () => {
    platform.native = true;
    network.status = { connected: true, connectionType: 'wifi' };
    const { onOnline } = await loadNet();
    await Promise.resolve();
    await Promise.resolve();
    const cb = vi.fn();
    const off = onOnline(cb);
    network.listeners.forEach((l) =>
      l({ connected: false, connectionType: 'none' }),
    );
    expect(cb).not.toHaveBeenCalled();
    off();
  });

  it('disposer stops further cb invocations and is idempotent', async () => {
    platform.native = true;
    network.status = { connected: false, connectionType: 'none' };
    const { onOnline } = await loadNet();
    await Promise.resolve();
    await Promise.resolve();
    const cb = vi.fn();
    const off = onOnline(cb);
    off();
    expect(() => off()).not.toThrow();
    network.listeners.forEach((l) =>
      l({ connected: true, connectionType: 'wifi' }),
    );
    expect(cb).not.toHaveBeenCalled();
  });
});
