import { useMemo, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { AppProvider } from './AppContext';
import { SupabaseRepository } from './supabase-repository';
import { SyncRepo } from './sync-repository';
import { MigrationController } from './MigrationController';
import type { AsyncRepository } from './repository';

/**
 * repo 결정 계층 (계획 17 §7.1). useAuth 상태에 따라:
 *   - authenticated + uid + supabase → SyncRepo 주입 + MigrationController 마운트.
 *   - local-mode/기타 → 주입 없음(AppProvider 기본 동기 LocalRepository + seed) = 회귀 0.
 *
 * user 전환 시 새 repo → AppProvider key={uid}로 상태 리셋(다계정 격리, AC⑤-9).
 * supabase 접근은 여기서 SupabaseRepository를 통해 단일 경유한다.
 */
export function RepoBoundary({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const uid = session?.user?.id ?? null;

  const authed = status === 'authenticated' && !!uid && !!supabase;

  const wiring = useMemo<{
    repo: AsyncRepository | undefined;
    remote: SupabaseRepository | undefined;
  }>(() => {
    if (authed && uid && supabase) {
      const remote = new SupabaseRepository(supabase, uid);
      return { repo: new SyncRepo({ remote, userId: uid }), remote };
    }
    return { repo: undefined, remote: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, uid]);

  return (
    <AppProvider key={uid ?? 'local'} repository={wiring.repo}>
      {wiring.repo && wiring.remote && (
        <MigrationController remote={wiring.remote} repo={wiring.repo} />
      )}
      {children}
    </AppProvider>
  );
}
