import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * RepoBoundary는 useAuth 상태에 따라 repo를 결정해 AppProvider에 주입하고,
 * authenticated에서만 MigrationController를 마운트한다(§7.1).
 *
 * SyncRepo/SupabaseRepository/MigrationController는 mock으로 대체해 배선 결정만
 * 검증한다(실제 supabase 접근은 각 클래스 단위 테스트가 담당).
 */

const authState = {
  status: 'authenticated' as string,
  session: { user: { id: 'uid-1' } } as { user: { id: string } } | null,
};

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => authState,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { fake: 'client' },
  isSupabaseConfigured: true,
}));

const SupabaseRepositoryMock = vi.fn();
vi.mock('../supabase-repository', () => ({
  SupabaseRepository: class {
    constructor(...args: unknown[]) {
      SupabaseRepositoryMock(...args);
    }
  },
}));

const SyncRepoMock = vi.fn();
vi.mock('../sync-repository', () => ({
  SyncRepo: class {
    loadCached() {
      return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko' };
    }
    start() {}
    apply() {
      return Promise.resolve();
    }
    dispose() {}
    constructor(...args: unknown[]) {
      SyncRepoMock(...args);
    }
  },
}));

const MigrationControllerMock = vi.fn();
vi.mock('../MigrationController', () => ({
  MigrationController: (props: unknown) => {
    MigrationControllerMock(props);
    return <div data-testid="migration-controller" />;
  },
}));

import { RepoBoundary } from '../RepoBoundary';

const CHILD = <div data-testid="child">CHILD</div>;

beforeEach(() => {
  vi.clearAllMocks();
  authState.status = 'authenticated';
  authState.session = { user: { id: 'uid-1' } };
});

describe('RepoBoundary — authenticated', () => {
  it('constructs SyncRepo with the user id and renders children + MigrationController', () => {
    render(<RepoBoundary>{CHILD}</RepoBoundary>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(SyncRepoMock).toHaveBeenCalledTimes(1);
    expect(SupabaseRepositoryMock).toHaveBeenCalledWith({ fake: 'client' }, 'uid-1');
    expect(screen.getByTestId('migration-controller')).toBeInTheDocument();
  });
});

describe('RepoBoundary — local-mode', () => {
  beforeEach(() => {
    authState.status = 'local-mode';
    authState.session = null;
  });

  it('does NOT construct SyncRepo, renders children, no MigrationController', () => {
    render(<RepoBoundary>{CHILD}</RepoBoundary>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(SyncRepoMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('migration-controller')).toBeNull();
  });
});

describe('RepoBoundary — unauthenticated (defensive)', () => {
  beforeEach(() => {
    authState.status = 'unauthenticated';
    authState.session = null;
  });

  it('falls back to sync local repo, no SyncRepo, no MigrationController', () => {
    render(<RepoBoundary>{CHILD}</RepoBoundary>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(SyncRepoMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('migration-controller')).toBeNull();
  });
});
