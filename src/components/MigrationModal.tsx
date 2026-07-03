import { ko } from '../i18n/strings';
import styles from './MigrationModal.module.css';

export interface MigrationModalProps {
  /** "가져오기" — legacy 데이터를 계정으로 가져온다. */
  onImport: () => void;
  /** "새로 시작" — 가져오지 않고 재제안만 막는다(legacy 보존). */
  onSkip: () => void;
  /** 가져오기 진행 중이면 버튼 비활성화. */
  busy?: boolean;
}

/**
 * 로컬→계정 마이그레이션 제안 모달 (계획 17 §9.2). 순수 표현 컴포넌트 —
 * 부수효과는 전부 콜백(onImport/onSkip) 경유(supabase 직접 호출 금지, 계층 분리).
 */
export function MigrationModal({ onImport, onSkip, busy }: MigrationModalProps) {
  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="migrate-title"
      >
        <h2 id="migrate-title" className={styles.title}>
          {ko.migrateTitle}
        </h2>
        <p className={styles.body}>{ko.migrateBody}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onImport}
            disabled={busy}
          >
            {busy ? ko.migrateImporting : ko.migrateImport}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onSkip}
            disabled={busy}
          >
            {ko.migrateSkip}
          </button>
        </div>
      </div>
    </div>
  );
}
