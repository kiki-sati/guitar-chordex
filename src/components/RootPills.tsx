import styles from './RootPills.module.css';
import type { Note, RootIndex } from '../domain/types';

interface RootPillsProps {
  notes: readonly Note[];
  selected: RootIndex;
  onSelect: (i: RootIndex) => void;
}

/** 12음 루트 선택 pill (원본 pill 스타일, 라인 791). */
export function RootPills({ notes, selected, onSelect }: RootPillsProps) {
  return (
    <div className={styles.row}>
      {notes.map((n, i) => {
        const active = selected === i;
        return (
          <button
            key={n}
            type="button"
            aria-pressed={active}
            className={active ? `${styles.pill} ${styles.active}` : styles.pill}
            onClick={() => onSelect(i)}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
