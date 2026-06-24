import { useApp } from '../state/AppContext';
import { Segmented } from '../components/Segmented';
import { RootPills } from '../components/RootPills';
import { Fretboard } from '../components/Fretboard';
import { scaleNotes } from '../domain/scale';
import { noteName } from '../domain/notes';
import { NOTE, scaleDefs } from '../domain/constants';
import { scaleLabelKo, ko } from '../i18n/strings';
import styles from './ScalesView.module.css';
import type { ScaleType } from '../domain/types';

const SCALE_ORDER = Object.keys(scaleDefs) as ScaleType[];

/** 스케일 뷰 (원본 scaleView 라인 590-601). */
export function ScalesView() {
  const { state, dispatch } = useApp();
  const notes = scaleNotes(state.selectedRoot, state.scaleType);
  const name = noteName(state.selectedRoot) + ' ' + scaleLabelKo[state.scaleType];

  return (
    <div className="view-pad" style={{ padding: '22px 28px 56px' }}>
      <div className={styles.toolbar}>
        <Segmented
          options={SCALE_ORDER.map((k) => ({ value: k, label: scaleLabelKo[k] }))}
          value={state.scaleType}
          onChange={(v) => dispatch({ type: 'SET_SCALE_TYPE', scaleType: v })}
        />
      </div>
      <div className={styles.roots}>
        <RootPills
          notes={NOTE}
          selected={state.selectedRoot}
          onSelect={(i) => dispatch({ type: 'SET_ROOT', root: i })}
        />
      </div>

      <div className={styles.stack}>
        <div className={styles.panel}>
          <div className={styles.head}>
            <span className={styles.title}>{name + ' ' + ko.scaleTitleSuffix}</span>
            <span className={styles.sub}>{ko.scaleNoteMeta(notes.length)}</span>
          </div>
          <div className={styles.chips}>
            {notes.map((n, i) => (
              <div
                key={i}
                className={i === 0 ? `${styles.chip} ${styles.chipRoot}` : styles.chip}
              >
                <span className={styles.degree}>{i === 0 ? 'R' : i + 1}</span>
                {noteName(n)}
              </div>
            ))}
          </div>
          <Fretboard root={state.selectedRoot} scaleType={state.scaleType} />
        </div>

        <div className={styles.legend}>
          <span>
            <span className={`${styles.dot} ${styles.dotRoot}`} />
            {ko.legendRoot}
          </span>
          <span>
            <span className={`${styles.dot} ${styles.dotNote}`} />
            {ko.legendNote}
          </span>
        </div>
      </div>
    </div>
  );
}
