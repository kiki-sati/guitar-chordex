import { filledCount } from '../../domain/sheet';
import { ko } from '../../i18n/strings';
import type { Sheet } from '../../domain/types';
import styles from './SavedSheets.module.css';

interface SavedSheetsProps {
  sheets: Sheet[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * 저장된 악보 목록. 원본 builderView 라인 661-666.
 * 제목 · `timeSig · N코드 · date` 메타 + [불러오기][삭제].
 * 저장된 악보가 없으면 렌더하지 않음(null).
 */
export function SavedSheets({ sheets, onLoad, onDelete }: SavedSheetsProps) {
  if (sheets.length === 0) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.title}>{ko.builderSavedTitle(sheets.length)}</div>
      <div className={styles.list}>
        {sheets.map((sh) => (
          <div key={sh.id} className={styles.item}>
            <div className={styles.info}>
              <div className={styles.sheetTitle}>{sh.title}</div>
              <div className={styles.meta}>
                {sh.timeSig +
                  ' · ' +
                  ko.builderChordCount(filledCount(sh.seq)) +
                  ' · ' +
                  sh.date}
              </div>
            </div>
            <button
              type="button"
              className={styles.loadBtn}
              onClick={() => onLoad(sh.id)}
            >
              {ko.builderLoad}
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(sh.id)}
            >
              {ko.builderDelete}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
