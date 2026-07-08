import { BeatCell } from './BeatCell';
import { sequenceToMeasures } from '../../domain/sheet';
import { ko } from '../../i18n/strings';
import type { SheetSequence } from '../../domain/types';
import styles from './MeasureGrid.module.css';

interface MeasureGridProps {
  sequence: SheetSequence;
  beats: number;
  armed: boolean;
  onBeatClick: (absoluteIndex: number) => void;
  onRemoveMeasure: (measureIndex: number) => void;
}

/**
 * 마디 격자. 원본 builderView 라인 656-657(4열 컨테이너) + chartCell 라인 637-642.
 * 계산 로직 직접 구현 금지 — sequenceToMeasures(domain)만 호출.
 * 각 마디는 beats 열(grid). 마디 하단 2px ink 경계, 컨테이너 우측 2px ink(CSS).
 */
export function MeasureGrid({
  sequence,
  beats,
  armed,
  onBeatClick,
  onRemoveMeasure,
}: MeasureGridProps) {
  const measures = sequenceToMeasures(sequence, beats);

  return (
    <div className={styles.container}>
      {measures.map((measure, mi) => (
        <div key={mi} className={styles.measure}>
          <div
            className={styles.beats}
            style={{ gridTemplateColumns: `repeat(${beats}, 1fr)` }}
          >
            {measure.map((slot, ci) => (
              <BeatCell
                key={ci}
                slot={slot}
                col={ci}
                armed={armed}
                onClick={() => onBeatClick(mi * beats + ci)}
              />
            ))}
          </div>
          <div className={styles.foot}>
            <span className={styles.measureNum}>{mi + 1}</span>
            {measures.length > 1 ? (
              <button
                type="button"
                className={styles.removeBtn}
                title={ko.builderRemoveMeasure}
                aria-label={ko.builderRemoveMeasure}
                onClick={() => onRemoveMeasure(mi)}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
