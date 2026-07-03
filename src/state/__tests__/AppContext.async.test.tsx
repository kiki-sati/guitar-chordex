import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../AppContext';
import type { AsyncRepository } from '../repository';
import type { PersistedState } from '../persist';
import type { RepoChange } from '../repo-change';

function base(over: Partial<PersistedState> = {}): PersistedState {
  return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko', ...over };
}

/** AsyncRepository spy mock. onMerged 콜백을 캡처해 수동 통지 가능. */
function makeAsyncRepo(cached: PersistedState = base()) {
  const onMergedRef = { current: null as null | ((m: PersistedState) => void) };
  const repo: AsyncRepository = {
    loadCached: vi.fn(() => cached),
    start: vi.fn((cb: (m: PersistedState) => void) => {
      onMergedRef.current = cb;
    }),
    apply: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  return { repo, onMergedRef };
}

// 잔디 기록 → LOG_PRACTICE dispatch용 헬퍼 컴포넌트.
function Probe() {
  const { state, dispatch } = useApp();
  return (
    <div>
      <span data-testid="lang">{state.lang}</span>
      <span data-testid="grass-count">{Object.keys(state.grass).length}</span>
      <button onClick={() => dispatch({ type: 'LOG_PRACTICE' })}>log</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
});

describe('AppProvider — async repo (B5-A1)', () => {
  it('B5-A1: inits from loadCached, calls start, dispatch → apply([grass])', async () => {
    const { repo } = makeAsyncRepo(base({ lang: 'en' }));
    render(
      <AppProvider repository={repo}>
        <Probe />
      </AppProvider>,
    );
    // init from cache
    expect(repo.loadCached).toHaveBeenCalled();
    expect(screen.getByTestId('lang').textContent).toBe('en');
    // start called with onMerged callback
    await waitFor(() => expect(repo.start).toHaveBeenCalledTimes(1));

    // dispatch LOG_PRACTICE → effect diff → apply([grass change])
    act(() => {
      screen.getByRole('button', { name: 'log' }).click();
    });
    await waitFor(() => expect(repo.apply).toHaveBeenCalled());
    const calls = (repo.apply as ReturnType<typeof vi.fn>).mock.calls;
    const changes = calls[calls.length - 1][0] as RepoChange[];
    expect(changes.some((c) => c.kind === 'grass')).toBe(true);
  });
});

describe('AppProvider — async repo onMerged → HYDRATE (B5-A2)', () => {
  it('B5-A2: onMerged callback updates state via HYDRATE', async () => {
    const { repo, onMergedRef } = makeAsyncRepo(base());
    render(
      <AppProvider repository={repo}>
        <Probe />
      </AppProvider>,
    );
    await waitFor(() => expect(onMergedRef.current).not.toBeNull());
    expect(screen.getByTestId('grass-count').textContent).toBe('0');

    // server merge notifies with populated grass
    act(() => {
      onMergedRef.current!(base({ grass: { d1: 1, d2: 2 } }));
    });
    await waitFor(() =>
      expect(screen.getByTestId('grass-count').textContent).toBe('2'),
    );
  });

  it('calls dispose on unmount', async () => {
    const { repo } = makeAsyncRepo();
    const { unmount } = render(
      <AppProvider repository={repo}>
        <Probe />
      </AppProvider>,
    );
    await waitFor(() => expect(repo.start).toHaveBeenCalled());
    unmount();
    expect(repo.dispose).toHaveBeenCalled();
  });
});

describe('AppProvider — sync repo path unchanged (B5-A3 regression)', () => {
  it('B5-A3: no injected repo → uses sync LocalRepository, apply never called', async () => {
    // default (sync LocalRepository) — dispatch should persist to localStorage, not call apply.
    render(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
    act(() => {
      screen.getByRole('button', { name: 'log' }).click();
    });
    // grass persisted to legacy cs_grass key via sync saveAll
    await waitFor(() => {
      const raw = localStorage.getItem('cs_grass');
      expect(raw).toBeTruthy();
    });
  });
});
