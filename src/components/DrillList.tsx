import { ko } from '../i18n/strings';
import styles from './DrillList.module.css';
import type { Drill } from '../domain/types';

interface DrillListProps {
  drills: Drill[];
  draftTitle: string;
  draftTarget: number;
  onSetCount: (id: string, n: number) => void;
  onBumpTarget: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  onAdd: () => void;
  onDraftTitle: (v: string) => void;
  onDraftTarget: (v: number) => void;
}

function Stamp({
  filled,
  onClick,
}: {
  filled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={filled ? `${styles.stamp} ${styles.stampFilled}` : styles.stamp}
      onClick={onClick}
      aria-pressed={filled}
    >
      {filled ? (
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l4.5 4.5L19 6" />
        </svg>
      ) : null}
    </button>
  );
}

/** 드릴 체크리스트 (원본 drillsView 라인 481-522). */
export function DrillList({
  drills,
  draftTitle,
  draftTarget,
  onSetCount,
  onBumpTarget,
  onRemove,
  onReset,
  onAdd,
  onDraftTitle,
  onDraftTarget,
}: DrillListProps) {
  const done = drills.filter((d) => d.target > 0 && d.count >= d.target).length;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <div className={styles.heading}>{ko.drillTitle}</div>
          <div className={styles.subHeading}>
            {ko.drillSub(done, drills.length)}
          </div>
        </div>
        <button type="button" className={styles.clearBtn} onClick={onReset}>
          {ko.drillClear}
        </button>
      </div>

      <div>
        {drills.length ? (
          drills.map((d) => {
            const complete = d.count >= d.target;
            const circles = [];
            for (let i = 0; i < d.target; i++) {
              const filled = i < d.count;
              circles.push(
                <Stamp
                  key={i}
                  filled={filled}
                  onClick={() =>
                    onSetCount(d.id, i + 1 === d.count ? i : i + 1)
                  }
                />,
              );
            }
            return (
              <div key={d.id} className={styles.row}>
                <div className={styles.rowHead}>
                  <span
                    className={styles.bullet}
                    style={{ background: complete ? 'var(--c-accent)' : '#dcdbd7' }}
                  />
                  <span
                    className={
                      complete ? `${styles.rowTitle} ${styles.done}` : styles.rowTitle
                    }
                  >
                    {d.title}
                  </span>
                  <span className={styles.spacer} />
                  <span
                    className={styles.counter}
                    style={{ color: complete ? 'var(--c-accent)' : 'var(--c-muted)' }}
                  >
                    {d.count + ' / ' + d.target}
                  </span>
                  <div className={styles.stepGroup}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      title={ko.drillBumpDown}
                      aria-label={ko.drillBumpDown}
                      onClick={() => onBumpTarget(d.id, -1)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      title={ko.drillBumpUp}
                      aria-label={ko.drillBumpUp}
                      onClick={() => onBumpTarget(d.id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    title={ko.drillDelete}
                    aria-label={ko.drillDelete}
                    onClick={() => onRemove(d.id)}
                  >
                    ×
                  </button>
                </div>
                <div className={styles.stamps}>{circles}</div>
              </div>
            );
          })
        ) : (
          <div className={styles.empty}>{ko.drillEmpty}</div>
        )}
      </div>

      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          value={draftTitle}
          onChange={(e) => onDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAdd();
          }}
          placeholder={ko.drillInputPlaceholder}
          aria-label={ko.drillInputPlaceholder}
        />
        <div className={styles.targetGroup}>
          <span className={styles.targetLabel}>{ko.drillTargetLabel}</span>
          <button
            type="button"
            className={styles.stepBtn}
            aria-label={ko.drillBumpDown}
            onClick={() => onDraftTarget(Math.max(1, (Number(draftTarget) || 5) - 1))}
          >
            −
          </button>
          <span className={styles.targetValue}>{draftTarget}</span>
          <button
            type="button"
            className={styles.stepBtn}
            aria-label={ko.drillBumpUp}
            onClick={() => onDraftTarget(Math.min(40, (Number(draftTarget) || 5) + 1))}
          >
            +
          </button>
          <span className={styles.targetLabel}>{ko.drillTargetUnit}</span>
        </div>
        <button type="button" className={styles.addBtn} onClick={onAdd}>
          {ko.drillAdd}
        </button>
      </div>
    </div>
  );
}
