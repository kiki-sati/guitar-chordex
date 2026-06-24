import styles from './StatCard.module.css';

interface StatCardProps {
  value: string;
  label: string;
}

/** 통계 카드 (원본 practiceView stat 라인 676). */
export function StatCard({ value, label }: StatCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
