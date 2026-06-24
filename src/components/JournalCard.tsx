import styles from './JournalCard.module.css';
import type { JournalEntry } from '../domain/types';

interface JournalCardProps {
  entry: JournalEntry;
}

/** 연습 일지 카드 (원본 journalCard 라인 701-708). */
export function JournalCard({ entry }: JournalCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.date}>{entry.date}</span>
        <span className={styles.title}>{entry.title}</span>
        <span className={styles.minutes}>{entry.minutes + '분'}</span>
      </div>
      {entry.chords && entry.chords.length ? (
        <div className={styles.chords}>
          {entry.chords.map((c, i) => (
            <span key={i} className={styles.chord}>
              {c}
            </span>
          ))}
        </div>
      ) : null}
      {entry.notes ? <div className={styles.notes}>{entry.notes}</div> : null}
    </div>
  );
}
