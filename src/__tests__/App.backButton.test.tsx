import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Android 하드웨어 뒤로가기(@capacitor/app backButton) 검증.
 *
 * 리스너는 detailChord 기반으로 우선순위를 둔다:
 *   1) 상세 열림 → CLOSE_DETAIL (뷰 이동·종료 아님)
 *   2) 상세 없음 + view≠home → SET_VIEW home
 *   3) 상세 없음 + home → exitApp
 * backButton 1회 = dispatch 1회 (이중 pop 없음). native 미러(history)는 비활성.
 */

// vi.mock 팩토리는 파일 상단으로 호이스팅되므로, 참조하는 상태도 vi.hoisted로 올린다.
type BackCb = () => void;
const h = vi.hoisted(() => ({
  platform: { native: true },
  backListeners: [] as BackCb[],
  exitApp: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.platform.native },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string, cb: BackCb) => {
      if (event === 'backButton') h.backListeners.push(cb);
      return Promise.resolve({ remove: vi.fn() });
    }),
    exitApp: () => h.exitApp(),
  },
}));

const { platform, backListeners, exitApp } = h;

import { App } from '../App';

function fireBack() {
  act(() => {
    backListeners[backListeners.length - 1]?.();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  backListeners.length = 0;
  platform.native = true;
  localStorage.clear();
});

describe('Android backButton', () => {
  it('closes the detail screen (does not exit or jump home) when detail is open', async () => {
    const user = userEvent.setup();
    render(<App />);
    // go to dictionary and open a detail screen
    await user.click(screen.getByRole('button', { name: /코드 사전/ }));
    const allForms = screen.getAllByLabelText('모든 폼');
    await user.click(allForms[0]);
    expect(screen.getByText(/ALL VOICINGS/)).toBeInTheDocument();

    // hardware back -> only closes detail, returns to dictionary
    fireBack();
    expect(screen.queryByText(/ALL VOICINGS/)).toBeNull();
    expect(screen.getByPlaceholderText(/코드 검색/)).toBeInTheDocument();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('navigates to home when no detail is open and view != home', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /코드 사전/ }));
    expect(screen.getByPlaceholderText(/코드 검색/)).toBeInTheDocument();

    fireBack();
    // back on a non-home view returns home (streak card is home-only)
    expect(screen.getByText('🔥 STREAK')).toBeInTheDocument();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('exits the app when on home with no detail open', () => {
    render(<App />);
    expect(screen.getByText('🔥 STREAK')).toBeInTheDocument();

    fireBack();
    expect(exitApp).toHaveBeenCalledTimes(1);
  });
});
