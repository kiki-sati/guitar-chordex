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
import {
  isAsyncRepository,
  type AsyncRepository,
  type Repository,
} from './repository';
import type { PersistedState } from './persist';
import { diffChanges } from './diff-changes';
import { loadSheets, saveSheets } from './sheet-persist';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  children: ReactNode;
  /**
   * 영속화 어댑터. 미지정 시 동기 LocalRepository(localStorage).
   *   - 동기 Repository/미지정 → 기존 loadAll()/saveAll(patch) 경로(회귀 0).
   *   - AsyncRepository(SyncRepo) → loadCached() 즉시 + start() 백그라운드 pull
   *     + apply(diffChanges) (계획 17 §4.2/§7.2).
   */
  repository?: Repository | AsyncRepository;
}

/** 상태에서 persisted 슬라이스만 추출(effect diff/save 공용). */
function persistedOf(state: AppState): PersistedState {
  return {
    grass: state.grass,
    journal: state.journal,
    drills: state.drills,
    collected: state.collected,
    lang: state.lang,
  };
}

export function AppProvider({ children, repository }: AppProviderProps) {
  // 주입된 repo가 없으면 기본 동기 LocalRepository. 동일 마운트 동안 안정한 참조.
  const repo = useMemo<Repository | AsyncRepository>(
    () => repository ?? new LocalRepository(),
    [repository],
  );
  const async = isAsyncRepository(repo);

  // sheets는 동기화 계층(PersistedState)과 분리된 로컬 전용 슬라이스(cs_sheets, PR-1).
  // repo와 무관하게 sheet-persist에서 로드한다(로그인 유저도 로컬만 — 계획 §6.3 Q5).
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initState(async ? repo.loadCached() : repo.loadAll(), loadSheets()),
  );

  // HYDRATE로 인한 상태 변경은 push 대상이 아니다(서버에서 온 값 재푸시 방지).
  // start 콜백이 이 플래그를 세우면 다음 persist-effect 실행은 apply를 건너뛰고
  // prevPersisted만 동기화한다.
  const skipNextApply = useRef(false);

  // 백그라운드 pull(async): start(onMerged→HYDRATE) 1회 + dispose(언마운트).
  useEffect(() => {
    if (!isAsyncRepository(repo)) return;
    repo.start((merged) => {
      skipNextApply.current = true;
      dispatch({ type: 'HYDRATE', persisted: merged });
    });
    return () => repo.dispose();
  }, [repo]);

  // 영속화: 영속 키 변경 시. 첫 마운트(load 직후)는 skip.
  const firstRun = useRef(true);
  const prevPersisted = useRef<PersistedState>(persistedOf(state));
  useEffect(() => {
    const next = persistedOf(state);
    if (firstRun.current) {
      firstRun.current = false;
      prevPersisted.current = next;
      return;
    }
    if (isAsyncRepository(repo)) {
      if (skipNextApply.current) {
        // HYDRATE 유발 변경: push하지 않고 기준선만 갱신.
        skipNextApply.current = false;
        prevPersisted.current = next;
        return;
      }
      // prev→next diff → RepoChange[] → apply(캐시+큐+push).
      const changes = diffChanges(prevPersisted.current, next);
      prevPersisted.current = next;
      if (changes.length > 0) void repo.apply(changes);
    } else {
      prevPersisted.current = next;
      repo.saveAll(next);
    }
  }, [
    repo,
    state.grass,
    state.journal,
    state.drills,
    state.collected,
    state.lang,
  ]);

  // 악보(sheets) 영속화: cs_sheets 로컬 전용 — **동기화 경로와 완전 분리**(PR-1, 계획 §6.3).
  // repo(SyncRepo/LocalRepository)를 거치지 않으므로 서버로 새지 않는다. 첫 마운트는 skip.
  const sheetsFirstRun = useRef(true);
  useEffect(() => {
    if (sheetsFirstRun.current) {
      sheetsFirstRun.current = false;
      return;
    }
    saveSheets(state.sheets);
  }, [state.sheets]);

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
