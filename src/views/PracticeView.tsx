import { useApp } from '../state/AppContext';
import { StatCard } from '../components/StatCard';
import { DrillList } from '../components/DrillList';
import { GrassHeatmap } from '../components/GrassHeatmap';
import { JournalForm } from '../components/JournalForm';
import { JournalCard } from '../components/JournalCard';
import { stats } from '../domain/practice';
import { ko } from '../i18n/strings';
import styles from './PracticeView.module.css';

/** 연습 기록 (원본 practiceView 라인 675-700). */
export function PracticeView() {
  const { state, dispatch } = useApp();
  const st = stats(state.grass);

  return (
    <div className="view-pad" style={{ padding: '22px 28px 56px' }}>
      <div className={styles.stack}>
        <div className={styles.statsRow}>
          <StatCard value={st.streak + '일'} label={ko.statStreak} />
          <StatCard value={st.days + '일'} label={ko.statDays} />
          <StatCard value={st.week + '회'} label={ko.statWeek} />
          <StatCard value={st.total + '회'} label={ko.statTotal} />
        </div>

        <DrillList
          drills={state.drills}
          draftTitle={state.dTitle}
          draftTarget={state.dTarget}
          onSetCount={(id, n) => dispatch({ type: 'SET_DRILL_COUNT', id, n })}
          onBumpTarget={(id, delta) =>
            dispatch({ type: 'BUMP_DRILL_TARGET', id, delta })
          }
          onRemove={(id) => dispatch({ type: 'REMOVE_DRILL', id })}
          onReset={() => dispatch({ type: 'RESET_DRILLS' })}
          onAdd={() => dispatch({ type: 'ADD_DRILL' })}
          onDraftTitle={(v) =>
            dispatch({ type: 'SET_DRILL_DRAFT', patch: { dTitle: v } })
          }
          onDraftTarget={(v) =>
            dispatch({ type: 'SET_DRILL_DRAFT', patch: { dTarget: v } })
          }
        />

        <div className={styles.grassPanel}>
          <div className={styles.grassHead}>
            <div className={styles.grassTitle}>{ko.grassTitle}</div>
            <button
              type="button"
              className={styles.logBtn}
              onClick={() => dispatch({ type: 'LOG_PRACTICE' })}
            >
              {ko.grassLog}
            </button>
          </div>
          <GrassHeatmap grass={state.grass} cellSize={11} />
        </div>

        <JournalForm
          draft={{
            title: state.jTitle,
            minutes: state.jMin,
            chords: state.jChords,
            notes: state.jNotes,
          }}
          onChange={(patch) =>
            dispatch({ type: 'SET_JOURNAL_DRAFT', patch })
          }
          onSubmit={() => dispatch({ type: 'ADD_JOURNAL' })}
        />

        <div className={styles.records}>
          <div className={styles.recordsHead}>
            {ko.journalRecords(state.journal.length)}
          </div>
          {state.journal.map((j) => (
            <JournalCard key={j.id} entry={j} />
          ))}
        </div>
      </div>
    </div>
  );
}
