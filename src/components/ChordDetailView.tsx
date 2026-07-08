import { ChordDiagram } from './ChordDiagram';
import { allVoicings } from '../domain/voicing';
import { computeDiagram } from '../domain/diagram';
import { omittedInVoicing } from '../domain/voicing-pcs';
import { noteName } from '../domain/notes';
import { INTERVALS } from '../domain/constants';
import { ko } from '../i18n/strings';
import styles from './ChordDetailView.module.css';
import type { ChordDetail, CollectedChord, FretArray } from '../domain/types';

interface ChordDetailViewProps {
  detail: ChordDetail;
  onBack: () => void;
  onCollect: (c: CollectedChord) => void;
}

/**
 * 모든 폼 상세 화면 (구 ChordDetailModal 본문 이관 — 팝업 → 전용 화면).
 * 도메인 계산(allVoicings/computeDiagram/INTERVALS)만 호출, 음악 로직 직접 구현 없음.
 */
export function ChordDetailView({
  detail,
  onBack,
  onCollect,
}: ChordDetailViewProps) {
  const voicings = allVoicings(detail.root, detail.qualKey);
  // 톤 칩은 코드 공식 그대로(정확). 생략 여부는 폼별로 카드에 표시한다.
  const tones = INTERVALS[detail.qualKey].map((i) =>
    noteName((detail.root + i) % 12),
  );

  // 폼별 생략 공식 음(음이름 라벨). 사용자 혼란은 개별 폼 단위에서 생기므로
  // (예: 오픈 C9 x30330에서 5도 G가 빠짐) 각 폼마다 도메인 헬퍼로 판정한다.
  const omittedLabels = (fr: FretArray): string[] => {
    const pcs = omittedInVoicing(detail.root, detail.qualKey, fr);
    // 공식 인터벌 순서대로 라벨링(안정적 순서), 중복 제거.
    const seen = new Set<number>();
    const labels: string[] = [];
    INTERVALS[detail.qualKey].forEach((i) => {
      const pc = (detail.root + i) % 12;
      if (pcs.has(pc) && !seen.has(pc)) {
        seen.add(pc);
        labels.push(noteName(pc));
      }
    });
    return labels;
  };
  const hasOmission = voicings.some((fr) => omittedLabels(fr).length > 0);

  return (
    <div className={styles.screen}>
      <div className={styles.appbar}>
        <button
          type="button"
          className={styles.appbarBtn}
          aria-label={ko.detailBack}
          onClick={onBack}
        >
          ←
        </button>
        <span className={styles.appbarTitle}>{detail.name}</span>
        <button
          type="button"
          className={styles.appbarBtn}
          title={ko.actCollect}
          aria-label={ko.actCollect}
          onClick={() =>
            onCollect({
              name: detail.name,
              frets: voicings[0] ?? (['x', 'x', 'x', 'x', 'x', 'x'] as FretArray),
              key: detail.name,
            })
          }
        >
          ♥
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.eyebrow}>{ko.allVoicings(voicings.length)}</div>

        <div className={styles.tones}>
          {tones.map((t, i) => (
            <span key={i} data-testid="tone-chip" className={styles.tone}>
              {t}
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
              const omitted = omittedLabels(fr);
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
                <div key={i} className={styles.formCard} data-testid="form-card">
                  <div className={styles.formLabel}>{i + 1 + ' · ' + pos}</div>
                  <ChordDiagram frets={fr} width={112} variant="tones" />
                  {omitted.length ? (
                    <div
                      className={styles.omitBadge}
                      data-testid="omit-badge"
                    >
                      {ko.omitBadge(omitted.join(', '))}
                    </div>
                  ) : null}
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
