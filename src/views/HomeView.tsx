import { useApp } from '../state/AppContext';
import { Segmented } from '../components/Segmented';
import { ChordDiagram } from '../components/ChordDiagram';
import { GrassHeatmap } from '../components/GrassHeatmap';
import { buildChord } from '../domain/chord';
import { stats } from '../domain/practice';
import { NOTE } from '../domain/constants';
import { ko } from '../i18n/strings';
import styles from './HomeView.module.css';
import type { Note, Quality } from '../domain/types';

const SUGGESTED: ReadonlyArray<readonly [Note, Quality]> = [
  ['C', 'maj'],
  ['G', 'maj'],
  ['A', 'min'],
  ['F', 'maj'],
  ['D', 'min'],
  ['E', 'min'],
];

/** 홈 뷰 (원본 homeView 라인 755-787). focus / board / minimal. */
export function HomeView() {
  const { state, dispatch } = useApp();
  const st = stats(state.grass);
  const suggested = SUGGESTED.map(([r, q]) => buildChord(NOTE.indexOf(r), q));
  const recent = state.journal.slice(0, 3);
  const layout = state.homeLayout;

  const logBtn = (className: string, label: string) => (
    <button
      type="button"
      className={className}
      onClick={() => dispatch({ type: 'LOG_PRACTICE' })}
    >
      {label}
    </button>
  );

  const grassCard = (cs: number) => (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>{ko.homeGrassTitle}</div>
        <div className={styles.cardMeta}>{ko.grassTotal(st.total)}</div>
      </div>
      <GrassHeatmap grass={state.grass} cellSize={cs} />
    </div>
  );

  const recentList = (
    <div className={styles.recentList}>
      {recent.length ? (
        recent.map((j) => (
          <div key={j.id} className={styles.recentItem}>
            <span className={styles.recentDate}>{j.date.slice(5)}</span>
            <span className={styles.recentTitle}>{j.title}</span>
          </div>
        ))
      ) : (
        <span className={styles.recentEmpty}>{ko.homeNoJournal}</span>
      )}
    </div>
  );

  const suggestRow = (
    <div className={styles.suggestGrid}>
      {suggested.map((c) => (
        <div key={c.name} className={styles.suggestCard}>
          <span className={styles.suggestName}>{c.name}</span>
          <ChordDiagram frets={c.frets} width={82} />
          <button type="button" className={styles.listenBtn} disabled title={ko.comingSoon}>
            {ko.homeListen}
          </button>
        </div>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (layout === 'focus') {
    body = (
      <div className={styles.focusWrap}>
        <div className={styles.focusTop}>
          <div className={styles.streakCard}>
            <div>
              <div className={styles.streakEyebrow}>{ko.homeStreakEyebrow}</div>
              <div className={styles.streakNumber}>
                {st.streak}
                <span className={styles.streakUnit}>{ko.homeStreakUnit}</span>
              </div>
            </div>
            {logBtn(styles.streakBtn, ko.homeLogBtn)}
          </div>
          {grassCard(11)}
        </div>
        <div>
          <div className={styles.sectionTitle}>{ko.homeSuggestTitle}</div>
          {suggestRow}
        </div>
      </div>
    );
  } else if (layout === 'board') {
    body = (
      <div className={styles.boardGrid}>
        <div className={`${styles.card} ${styles.boardSpan}`}>
          <div className={styles.cardTitle}>{ko.homeGrassTitle}</div>
          <GrassHeatmap grass={state.grass} cellSize={10} />
        </div>
        <div className={`${styles.card} ${styles.boardStreak}`}>
          <div className={styles.cardMeta}>{ko.homeStreakLabel}</div>
          <div className={styles.boardStreakNum}>{st.streak + '일'}</div>
          {logBtn(styles.boardLogBtn, ko.homeLogShort)}
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>{ko.homeRecentJournal}</div>
          {recentList}
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>{ko.homeCollected(state.collected.length)}</div>
          <div className={styles.collectedChips}>
            {state.collected.slice(0, 8).map((c, i) => (
              <span key={i} className={styles.collectedChip}>
                {c.name}
              </span>
            ))}
          </div>
          <button
            type="button"
            className={styles.builderBtn}
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'builder' })}
          >
            {ko.homeToBuilder}
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className={styles.minimalWrap}>
        <div className={styles.minimalStreak}>
          <div className={styles.cardMeta}>{ko.homeStreakLabel}</div>
          <div className={styles.minimalStreakNum}>{st.streak + '일'}</div>
          {logBtn(styles.minimalLogBtn, ko.grassLog)}
        </div>
        <div className={styles.card}>
          <GrassHeatmap grass={state.grass} cellSize={9} />
        </div>
        <div>
          <div className={styles.cardTitle}>{ko.homeRecentJournal}</div>
          {recentList}
        </div>
      </div>
    );
  }

  return (
    <div className="view-pad" style={{ padding: '24px 28px 56px' }}>
      <div className={styles.layoutToggle}>
        <Segmented
          options={[
            { value: 'focus', label: ko.layoutFocus },
            { value: 'board', label: ko.layoutBoard },
            { value: 'minimal', label: ko.layoutMinimal },
          ]}
          value={state.homeLayout}
          onChange={(v) => dispatch({ type: 'SET_HOME_LAYOUT', layout: v })}
        />
      </div>
      {body}
    </div>
  );
}
