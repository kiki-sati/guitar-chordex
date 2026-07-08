import { ChordDiagram } from './ChordDiagram';
import { allVoicings } from '../domain/voicing';
import { computeDiagram } from '../domain/diagram';
import { omittedFormulaPCs } from '../domain/voicing-pcs';
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
  // 코드 공식 음(칩)과 각 음의 피치클래스. 표시 중인 어떤 보이싱에서도
  // 울리지 않는 공식 음(재즈 관례상 5도 등 생략)을 도메인 헬퍼로 판정한다.
  const omitted = omittedFormulaPCs(detail.root, detail.qualKey, voicings);
  const tones = INTERVALS[detail.qualKey].map((i) => {
    const pc = (detail.root + i) % 12;
    return { name: noteName(pc), omitted: omitted.has(pc) };
  });
  const hasOmission = tones.some((t) => t.omitted);

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
            <span
              key={i}
              data-testid="tone-chip"
              data-tone-name={t.name}
              data-omitted={t.omitted}
              className={
                t.omitted ? styles.tone + ' ' + styles.toneOmitted : styles.tone
              }
              title={t.omitted ? ko.toneOmittedTitle : undefined}
            >
              {t.name}
            </span>
          ))}
        </div>
        {hasOmission ? (
          <div className={styles.tonesCaption}>{ko.tonesOmittedCaption}</div>
        ) : null}

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
