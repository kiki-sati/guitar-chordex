import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { reducer, initState, type Action, type AppState } from './appReducer';
import { LocalRepository } from './local-repository';
import type { Repository } from './repository';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  children: ReactNode;
  /**
   * 영속화 어댑터. 테스트나 후속 PR(Supabase/Sync)에서 다른 구현을
   * 주입할 수 있다. 미지정 시 LocalRepository(localStorage)가 사용된다.
   */
  repository?: Repository;
}

export function AppProvider({ children, repository }: AppProviderProps) {
  // 주입된 repo가 없으면 기본 LocalRepository 사용. 동일 마운트 동안 안정한 참조 유지.
  const repo = useMemo<Repository>(
    () => repository ?? new LocalRepository(),
    [repository],
  );

  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initState(repo.loadAll()),
  );

  // 영속화: 영속 키 변경 시 saveAll. 첫 마운트(load 직후)는 skip.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    repo.saveAll({
      grass: state.grass,
      journal: state.journal,
      drills: state.drills,
      collected: state.collected,
      lang: state.lang,
    });
  }, [
    repo,
    state.grass,
    state.journal,
    state.drills,
    state.collected,
    state.lang,
  ]);

  // 토스트 자동 소거 (1.9s, 원본 라인 450)
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 1900);
    return () => clearTimeout(t);
  }, [state.toast]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
