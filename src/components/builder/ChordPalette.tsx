import { ChordDiagram } from '../ChordDiagram';
import { ko } from '../../i18n/strings';
import type { CollectedChord, SheetSlot } from '../../domain/types';
import styles from './ChordPalette.module.css';

interface ChordPaletteProps {
  collected: CollectedChord[];
  armed: SheetSlot | null;
  onArm: (chord: SheetSlot) => void;
  onRemove: (index: number) => void;
  onGoToDictionary: () => void;
}

/**
 * 담은 코드 팔레트. 원본 builderView 라인 611-618.
 * collected를 다이어그램 카드 그리드로 렌더 · arm 토글 · ×제거 · '고르기/✓선택됨' 라벨.
 * 비었으면 "코드 사전에서 담기" 안내(사전 뷰 링크).
 * armed 판별은 name + frets JSON 비교(원본 라인 612) — 계산이 아닌 표시용 동등성.
 */
export function ChordPalette({
  collected,
  armed,
  onArm,
  onRemove,
  onGoToDictionary,
}: ChordPaletteProps) {
  if (collected.length === 0) {
    return (
      <div className={styles.empty}>
        {ko.builderPaletteEmpty}
        <button
          type="button"
          className={styles.emptyLink}
          onClick={onGoToDictionary}
        >
          {ko.builderPaletteEmptyLink}
        </button>
        {ko.builderPaletteEmptyTail}
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {collected.map((c, i) => {
        const isArmed =
          !!armed &&
          armed.name === c.name &&
          JSON.stringify(armed.frets) === JSON.stringify(c.frets);
        return (
          <div
            key={i}
            className={`${styles.card} ${isArmed ? styles.cardArmed : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={isArmed}
            onClick={() => onArm({ name: c.name, frets: c.frets })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onArm({ name: c.name, frets: c.frets });
              }
            }}
          >
            <span className={styles.name}>{c.name}</span>
            <ChordDiagram frets={c.frets} width={72} />
            <button
              type="button"
              className={styles.removeBtn}
              aria-label={ko.builderDelete}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
            >
              ×
            </button>
            <span className={isArmed ? styles.labelArmed : styles.label}>
              {isArmed ? ko.builderArmed : ko.builderArm}
            </span>
          </div>
        );
      })}
    </div>
  );
}
