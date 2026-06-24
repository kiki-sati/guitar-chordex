import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { reducer, initState, type Action, type AppState } from './appReducer';
import { load, save } from './persist';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initState(load()),
  );

  // 영속화: 영속 키 변경 시 save. 첫 마운트(load 직후)는 skip.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    save({
      grass: state.grass,
      journal: state.journal,
      drills: state.drills,
      collected: state.collected,
      lang: state.lang,
    });
  }, [
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
