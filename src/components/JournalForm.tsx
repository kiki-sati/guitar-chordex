import { ko } from '../i18n/strings';
import styles from './JournalForm.module.css';
import type { JournalDraftPatch } from '../state/appReducer';

interface JournalFormProps {
  draft: { title: string; minutes: number | string; chords: string; notes: string };
  onChange: (patch: JournalDraftPatch) => void;
  onSubmit: () => void;
}

/** 연습 일지 작성 폼 (원본 practiceView 라인 687-695). */
export function JournalForm({ draft, onChange, onSubmit }: JournalFormProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>{ko.journalWrite}</div>
      <div className={styles.fields}>
        <div className={styles.topRow}>
          <input
            className={`${styles.input} ${styles.titleInput}`}
            value={draft.title}
            onChange={(e) => onChange({ jTitle: e.target.value })}
            placeholder={ko.journalTitlePlaceholder}
            aria-label={ko.journalTitlePlaceholder}
          />
          <div className={styles.minWrap}>
            <input
              className={styles.input}
              value={draft.minutes}
              onChange={(e) => onChange({ jMin: e.target.value })}
              placeholder={ko.journalMinPlaceholder}
              aria-label={ko.journalMinPlaceholder}
            />
            <span className={styles.minSuffix}>{ko.journalMinUnit}</span>
          </div>
        </div>
        <input
          className={styles.input}
          value={draft.chords}
          onChange={(e) => onChange({ jChords: e.target.value })}
          placeholder={ko.journalChordsPlaceholder}
          aria-label={ko.journalChordsPlaceholder}
        />
        <textarea
          className={styles.textarea}
          value={draft.notes}
          onChange={(e) => onChange({ jNotes: e.target.value })}
          placeholder={ko.journalNotesPlaceholder}
          aria-label={ko.journalNotesPlaceholder}
          rows={3}
        />
        <button type="button" className={styles.submit} onClick={onSubmit}>
          {ko.journalSubmit}
        </button>
      </div>
    </div>
  );
}
