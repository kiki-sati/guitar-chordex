import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ChordDetail } from '../../domain/types';

// Capacitor.isNativePlatform() mock — 테스트별로 platform.native 토글
const platform = { native: false };
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native },
}));

import { useDetailHistory } from '../useDetailHistory';

const detail: ChordDetail = { root: 0, qualKey: 'maj', name: 'C' };

describe('useDetailHistory (web-only browser back mirror)', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    platform.native = false;
    // clean history state
    window.history.replaceState(null, '');
    pushSpy = vi.spyOn(window.history, 'pushState');
    backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  });

  afterEach(() => {
    pushSpy.mockRestore();
    backSpy.mockRestore();
  });

  it('pushes one history entry when the detail opens (null -> non-null)', () => {
    const { rerender } = renderHook(
      ({ d }: { d: ChordDetail | null }) => useDetailHistory(d, vi.fn()),
      { initialProps: { d: null as ChordDetail | null } },
    );
    expect(pushSpy).not.toHaveBeenCalled();
    rerender({ d: detail });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    // the pushed state marks our detail entry
    const arg = pushSpy.mock.calls[0][0] as { csDetail?: boolean } | null;
    expect(arg?.csDetail).toBe(true);
  });

  it('dispatches CLOSE_DETAIL on popstate while the detail is open', () => {
    const dispatch = vi.fn();
    renderHook(() => useDetailHistory(detail, dispatch));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'CLOSE_DETAIL' });
  });

  it('does not dispatch on popstate when no detail is open', () => {
    const dispatch = vi.fn();
    renderHook(() => useDetailHistory(null, dispatch));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('calls history.back() once on programmatic close (open then non-null -> null)', () => {
    const { rerender } = renderHook(
      ({ d }: { d: ChordDetail | null }) => useDetailHistory(d, vi.fn()),
      { initialProps: { d: null as ChordDetail | null } },
    );
    // real flow: open (pushes an entry) then close programmatically (button/HW)
    rerender({ d: detail });
    rerender({ d: null });
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it('does not call history.back() when close was triggered by popstate (guard)', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ d }: { d: ChordDetail | null }) => useDetailHistory(d, dispatch),
      { initialProps: { d: null as ChordDetail | null } },
    );
    // open first (push an entry)
    rerender({ d: detail });
    // user pressed browser back -> popstate fires while open
    window.dispatchEvent(new PopStateEvent('popstate'));
    // that popstate already consumed the entry; the resulting state close must NOT back() again
    rerender({ d: null });
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('is a no-op on native (no pushState, no popstate dispatch)', () => {
    platform.native = true;
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ d }: { d: ChordDetail | null }) => useDetailHistory(d, dispatch),
      { initialProps: { d: null as ChordDetail | null } },
    );
    rerender({ d: detail });
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
