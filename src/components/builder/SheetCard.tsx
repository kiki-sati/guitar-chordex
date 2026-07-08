import { Segmented } from '../Segmented';
import { UsedChordBox } from './UsedChordBox';
import { MeasureGrid } from './MeasureGrid';
import { beatsOf, filledCount } from '../../domain/sheet';
import { ko } from '../../i18n/strings';
import type { SheetSequence, SheetSlot, TimeSig } from '../../domain/types';
import styles from './SheetCard.module.css';

interface SheetCardProps {
  title: string;
  timeSig: TimeSig;
  sequence: SheetSequence;
  armed: SheetSlot | null;
  onTitleChange: (title: string) => void;
  onTimeSigChange: (timeSig: TimeSig) => void;
  onBeatClick: (absoluteIndex: number) => void;
  onRemoveMeasure: (measureIndex: number) => void;
  onAddMeasure: () => void;
  onClear: () => void;
  onSave: () => void;
}

const TIME_SIGS: TimeSig[] = ['4/4', '3/4', '6/8'];

/**
 * 악보 편집 카드. 원본 builderView 라인 644-659.
 * 제목 입력 · 박자표 세그(Segmented 재사용) · [▶재생(disabled·후속)][비우기][저장]
 * → hint 배너 → 큰 제목/N CHORDS → UsedChordBox → MeasureGrid → [+ 마디 추가].
 * 계산 로직 없음 — beatsOf/filledCount(domain)만 조회, 시퀀스 변환은 자식 위임.
 */
export function SheetCard({
  title,
  timeSig,
  sequence,
  armed,
  onTitleChange,
  onTimeSigChange,
  onBeatClick,
  onRemoveMeasure,
  onAddMeasure,
  onClear,
  onSave,
}: SheetCardProps) {
  const beats = beatsOf(timeSig);
  const filled = filledCount(sequence);

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <input
          className={styles.titleInput}
          value={title}
          placeholder={ko.builderTitlePlaceholder}
          aria-label={ko.builderTitlePlaceholder}
          onChange={(e) => onTitleChange(e.target.value)}
        />
        <Segmented
          options={TIME_SIGS.map((t) => ({ value: t, label: t }))}
          value={timeSig}
          onChange={onTimeSigChange}
        />
        {/* ▶재생: 오디오는 PR 범위 밖 — disabled + '준비 중' (기존 '듣기' 패턴) */}
        <button
          type="button"
          className={styles.playBtn}
          disabled
          title={ko.comingSoon}
        >
          {ko.builderPlay}
        </button>
        <button type="button" className={styles.clearBtn} onClick={onClear}>
          {ko.builderClear}
        </button>
        <button type="button" className={styles.saveBtn} onClick={onSave}>
          {ko.builderSave}
        </button>
      </div>

      <div className={`${styles.hint} ${armed ? styles.hintArmed : ''}`}>
        {armed ? (
          <span>
            <b>{armed.name}</b>
            {ko.builderArmedHintSuffix}
          </span>
        ) : (
          <span className={styles.hintIdle}>{ko.builderIdleHint}</span>
        )}
      </div>

      <div className={styles.meta}>
        <div className={styles.bigTitle}>{title || ko.builderUntitled}</div>
        <div className={styles.metaLine}>
          {timeSig + ' · ' + ko.builderChordsSuffix(filled)}
        </div>
      </div>

      <UsedChordBox sequence={sequence} />

      <MeasureGrid
        sequence={sequence}
        beats={beats}
        armed={!!armed}
        onBeatClick={onBeatClick}
        onRemoveMeasure={onRemoveMeasure}
      />

      <div className={styles.addRow}>
        <button type="button" className={styles.addBtn} onClick={onAddMeasure}>
          {ko.builderAddMeasure}
        </button>
      </div>
    </div>
  );
}
