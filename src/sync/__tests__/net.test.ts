import { describe, it, expect, vi, afterEach } from 'vitest';
import { isOnline, onOnline } from '../net';

function stubOnline(value: boolean | undefined): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  // restore a sane default
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  });
});

describe('isOnline', () => {
  it('returns true when navigator.onLine is true', () => {
    stubOnline(true);
    expect(isOnline()).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    stubOnline(false);
    expect(isOnline()).toBe(false);
  });

  it('returns true (optimistic) when navigator.onLine is undefined', () => {
    stubOnline(undefined);
    expect(isOnline()).toBe(true);
  });
});

describe('onOnline', () => {
  it('invokes callback when an online event fires', () => {
    const cb = vi.fn();
    const off = onOnline(cb);
    window.dispatchEvent(new Event('online'));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it('unsubscribes: callback not called after the returned disposer runs', () => {
    const cb = vi.fn();
    const off = onOnline(cb);
    off();
    window.dispatchEvent(new Event('online'));
    expect(cb).not.toHaveBeenCalled();
  });

  it('disposer is idempotent (calling twice does not throw)', () => {
    const cb = vi.fn();
    const off = onOnline(cb);
    off();
    expect(() => off()).not.toThrow();
  });
});
