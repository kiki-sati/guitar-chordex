import { ChordDiagram } from './ChordDiagram';
import { ko } from '../i18n/strings';
import styles from './ChordCard.module.css';
import type { Chord } from '../domain/types';

type CardSize = 'sm' | 'md' | 'lg';
const CARD_W: Record<CardSize, number> = { sm: 92, md: 108, lg: 128 };

interface ChordCardProps {
  chord: Chord;
  cardSize?: CardSize;
  onOpenDetail: (chord: Chord) => void;
  onCollect: (chord: Chord) => void;
  // 후속 슬롯: onPlay / onCopy — MVP는 disabled
}

const PATHS = {
  play: 'M6 4l13 8-13 8z',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z',
  copy: 'M9 9h10v11H9z M5 15H4V4h11v1',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
} as const;

function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** 코드 카드 (원본 chordCard 라인 543-555). 재생/복사는 disabled 슬롯. */
export function ChordCard({
  chord,
  cardSize = 'md',
  onOpenDetail,
  onCollect,
}: ChordCardProps) {
  const w = CARD_W[cardSize];
  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.body}
        title={ko.tipAllForms}
        onClick={() => onOpenDetail(chord)}
      >
        <div className={styles.titleRow}>
          {chord.roman ? (
            <span className={styles.roman}>{chord.roman}</span>
          ) : null}
          <span className={styles.name}>{chord.name}</span>
        </div>
        <ChordDiagram frets={chord.frets} width={w} />
      </button>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconBtn}
          title={ko.comingSoon}
          aria-label={ko.actPlay}
          disabled
        >
          <Icon name="play" />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={ko.actCollect}
          aria-label={ko.actCollect}
          onClick={() => onCollect(chord)}
        >
          <Icon name="bookmark" />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={ko.comingSoon}
          aria-label={ko.actCopy}
          disabled
        >
          <Icon name="copy" />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={ko.actAllForms}
          aria-label={ko.actAllForms}
          onClick={() => onOpenDetail(chord)}
        >
          <Icon name="grid" />
        </button>
      </div>
    </div>
  );
}
