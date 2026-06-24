import { ChordDiagram } from './ChordDiagram';
import { allVoicings } from '../domain/voicing';
import { computeDiagram } from '../domain/diagram';
import { noteName } from '../domain/notes';
import { INTERVALS } from '../domain/constants';
import { ko } from '../i18n/strings';
import styles from './ChordDetailModal.module.css';
import type { ChordDetail, CollectedChord } from '../domain/types';

interface ChordDetailModalProps {
  detail: ChordDetail;
  onClose: () => void;
  onCollect: (c: CollectedChord) => void;
}

/** 모든 폼 상세 모달 (원본 detailView 라인 361-382). */
export function ChordDetailModal({
  detail,
  onClose,
  onCollect,
}: ChordDetailModalProps) {
  const voicings = allVoicings(detail.root, detail.qualKey);
  const tones = INTERVALS[detail.qualKey].map((i) =>
    noteName((detail.root + i) % 12),
  );

  return (
    <div
      className={styles.scrim}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={detail.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>
              {ko.allVoicings(voicings.length)}
            </div>
            <div className={styles.title}>{detail.name}</div>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.tones}>
          {tones.map((t, i) => (
            <span key={i} className={styles.tone}>
              {t}
            </span>
          ))}
        </div>

        {voicings.length ? (
          <div className={styles.grid}>
            {voicings.map((fr, i) => {
              const g = computeDiagram(fr);
              const pos = g.showNut ? ko.formOpen : g.start + 'fr';
              const fc: CollectedChord = {
                name:
                  detail.name +
                  ' (' +
                  (g.showNut ? 'open' : g.start + 'fr') +
                  ')',
                frets: fr,
                key: detail.name + '-' + i,
              };
              return (
                <div key={i} className={styles.formCard}>
                  <div className={styles.formLabel}>{i + 1 + ' · ' + pos}</div>
                  <ChordDiagram frets={fr} width={112} variant="tones" />
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.circBtn}
                      title={ko.comingSoon}
                      aria-label={ko.actPlay}
                      disabled
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      className={styles.circBtn}
                      title={ko.actCollect}
                      aria-label={ko.actCollect}
                      onClick={() => onCollect(fc)}
                    >
                      ♥
                    </button>
                    <button
                      type="button"
                      className={styles.circBtn}
                      title={ko.comingSoon}
                      aria-label={ko.actCopy}
                      disabled
                    >
                      ⧉
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>{ko.modalEmpty}</div>
        )}
      </div>
    </div>
  );
}
