import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useApp } from './state/AppContext';
import { RepoBoundary } from './state/RepoBoundary';
import { useDetailHistory } from './hooks/useDetailHistory';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { ChordDetailView } from './components/ChordDetailView';
import { HomeView } from './views/HomeView';
import { DictionaryView } from './views/DictionaryView';
import { ScalesView } from './views/ScalesView';
import { PracticeView } from './views/PracticeView';
import { BuilderView } from './views/BuilderView';
import { stats } from './domain/practice';
import { headerTitles, ko } from './i18n/strings';
import styles from './App.module.css';

function Shell() {
  const { state, dispatch } = useApp();
  const st = stats(state.grass);
  // 상세 화면은 자체 앱바를 가지므로 앱 Header를 렌더하지 않는다(전체 화면 전환).
  const isDetail = state.view === 'chordDetail';
  const [title, , eyebrow] = headerTitles[state.view] ?? ['', '', ''];

  // 브라우저/PWA 뒤로가기 → 상세 닫기 (웹 전용; 네이티브는 아래 backButton 리스너가 담당).
  useDetailHistory(state.detailChord, dispatch);

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
    case 'builder':
      view = <BuilderView />;
      break;
    case 'chordDetail':
      // detailChord가 null이면(비정상 진입) 홈으로 안전 폴백
      view = state.detailChord ? (
        <ChordDetailView
          detail={state.detailChord}
          onBack={() => dispatch({ type: 'CLOSE_DETAIL' })}
          onCollect={(c) => dispatch({ type: 'COLLECT', chord: c })}
        />
      ) : (
        <HomeView />
      );
      break;
    default:
      // lesson는 아직 비활성 → 도달 불가, 안전 폴백
      view = <HomeView />;
  }

  return (
    <div className={`app-shell ${styles.shell}`}>
      <Sidebar />
      <main className={styles.main}>
        {isDetail ? null : (
          <Header
            eyebrow={eyebrow}
            title={title}
            streakChip={st.streak + '일 연속'}
            onLogPractice={() => dispatch({ type: 'LOG_PRACTICE' })}
            logBtnLabel={ko.headerLogBtn}
          />
        )}
        <div className={styles.viewport}>{view}</div>
      </main>

      <Toast message={state.toast} />
    </div>
  );
}

export function App() {
  return (
    <RepoBoundary>
      <Shell />
    </RepoBoundary>
  );
}
