import styles from './Segmented.module.css';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}
interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
}

/** pill 세그 토글 (원본 seg 스타일, 라인 790). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className={styles.group} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? `${styles.seg} ${styles.active}` : styles.seg}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
