import { ChordDiagram } from '../ChordDiagram';
import { usedChords } from '../../domain/sheet';
import type { SheetSequence } from '../../domain/types';
import styles from './UsedChordBox.module.css';

interface UsedChordBoxProps {
  sequence: SheetSequence;
}

/**
 * 악보에 사용된 고유 코드 다이어그램 박스. 원본 builderView 라인 624-629.
 * usedChords(domain)로 first-seen 고유 코드 추출 → ChordDiagram(width 72) 재사용.
 * 사용 코드가 없으면 렌더하지 않음(null).
 */
export function UsedChordBox({ sequence }: UsedChordBoxProps) {
  const used = usedChords(sequence);
  if (used.length === 0) return null;

  return (
    <div className={styles.box}>
      <div className={styles.row}>
        {used.map((c) => (
          <div key={c.name} className={styles.item}>
            <span className={styles.name}>{c.name}</span>
            <ChordDiagram frets={c.frets} width={72} />
          </div>
        ))}
      </div>
    </div>
  );
}
