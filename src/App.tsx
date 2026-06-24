import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AppProvider, useApp } from './state/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { ChordDetailModal } from './components/ChordDetailModal';
import { HomeView } from './views/HomeView';
import { DictionaryView } from './views/DictionaryView';
import { ScalesView } from './views/ScalesView';
import { PracticeView } from './views/PracticeView';
import { stats } from './domain/practice';
import { headerTitles, ko } from './i18n/strings';
import styles from './App.module.css';

function Shell() {
  const { state, dispatch } = useApp();
  const st = stats(state.grass);
  const [title, , eyebrow] = headerTitles[state.view];

  // Android 하드웨어 뒤로가기: 모달 열림 → 닫기, 홈 아님 → 홈, 홈 → 앱 종료
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: PluginListenerHandle | undefined;
    void CapApp.addListener('backButton', () => {
      if (state.detailChord) dispatch({ type: 'CLOSE_DETAIL' });
      else if (state.view !== 'home') dispatch({ type: 'SET_VIEW', view: 'home' });
      else void CapApp.exitApp();
    }).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, [state.detailChord, state.view, dispatch]);

  let view: React.ReactNode;
  switch (state.view) {
    case 'home':
      view = <HomeView />;
      break;
    case 'dictionary':
      view = <DictionaryView />;
      break;
    case 'scales':
      view = <ScalesView />;
      break;
    case 'practice':
      view = <PracticeView />;
      break;
    default:
      // builder/lesson는 MVP 비활성 → 도달 불가, 안전 폴백
      view = <HomeView />;
  }

  return (
    <div className={`app-shell ${styles.shell}`}>
      <Sidebar />
      <main className={styles.main}>
        <Header
          eyebrow={eyebrow}
          title={title}
          streakChip={st.streak + '일 연속'}
          onLogPractice={() => dispatch({ type: 'LOG_PRACTICE' })}
          logBtnLabel={ko.headerLogBtn}
        />
        <div className={styles.viewport}>{view}</div>
      </main>

      {state.detailChord ? (
        <ChordDetailModal
          detail={state.detailChord}
          onClose={() => dispatch({ type: 'CLOSE_DETAIL' })}
          onCollect={(c) => dispatch({ type: 'COLLECT', chord: c })}
        />
      ) : null}

      <Toast message={state.toast} />
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
