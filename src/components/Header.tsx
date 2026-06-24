import styles from './Header.module.css';

interface HeaderProps {
  eyebrow: string;
  title: string;
  streakChip: string;
  onLogPractice: () => void;
  logBtnLabel: string;
}

/** 메인 헤더 (원본 라인 75-86). */
export function Header({
  eyebrow,
  title,
  streakChip,
  onLogPractice,
  logBtnLabel,
}: HeaderProps) {
  return (
    <header className={`app-head ${styles.head}`}>
      <div className={styles.titleWrap}>
        <div className={styles.eyebrow}>{eyebrow}</div>
        <div className={styles.title}>{title}</div>
      </div>
      <div className={`head-actions ${styles.actions}`}>
        <div className={`streak-chip ${styles.chip}`}>
          <span className="ae">🔥</span>
          {streakChip}
        </div>
        <button type="button" className={styles.logBtn} onClick={onLogPractice}>
          {logBtnLabel}
        </button>
      </div>
    </header>
  );
}
