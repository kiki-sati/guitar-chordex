import { ko } from '../../i18n/strings';
import type { SheetSlot } from '../../domain/types';
import styles from './BeatCell.module.css';

interface BeatCellProps {
  slot: SheetSlot | null;
  /** 마디 내 열 인덱스 (0=마디 첫 박 → 좌측 굵은 경계). */
  col: number;
  /** 현재 arm된 코드가 있는지(빈 박 기호 · 툴팁 분기). */
  armed: boolean;
  onClick: () => void;
}

/**
 * 악보 한 박(beat) 셀. 원본 beatCell (라인 631-635).
 * 계산 로직 없음 — 클릭 시 onClick만 호출(place/clear/toast 분기는 reducer PLACE_AT).
 * 채워진 박: 코드명 굵게. 빈 박: armed면 '+', 아니면 '·'.
 */
export function BeatCell({ slot, col, armed, onClick }: BeatCellProps) {
  const title = slot
    ? armed
      ? ko.builderCellReplace
      : ko.builderCellClear
    : ko.builderCellPlace;

  return (
    <div
      className={`${styles.cell} ${col === 0 ? styles.barStart : ''}`}
      role="button"
      tabIndex={0}
      title={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {slot ? (
        <span className={styles.name}>{slot.name}</span>
      ) : (
        <span className={armed ? styles.plus : styles.dot}>
          {armed ? '+' : '·'}
        </span>
      )}
    </div>
  );
}
