import { scaleNotes } from '../domain/scale';
import { noteName } from '../domain/notes';
import { OPEN_MIDI } from '../domain/constants';
import type { RootIndex, ScaleType } from '../domain/types';

interface FretboardProps {
  root: RootIndex;
  scaleType: ScaleType;
}

const ACCENT = '#0052cc';
const INK = '#000';
const BORDER = '#e6e6e6';
const FAINT = '#9a9893';

// 기하 (원본 라인 582-588)
const FR = 12;
const W = 640;
const H = 158;
const ML = 30;
const MT = 16;
const MB = 24;

/** 스케일 지판 (원본 fretboardEl 라인 581-589). */
export function Fretboard({ root, scaleType }: FretboardProps) {
  const set = new Set(scaleNotes(root, scaleType));
  const open = OPEN_MIDI;
  const fw = (W - ML - 12) / FR;
  const sh = (H - MT - MB) / 5;
  const fx = (f: number): number => ML + f * fw;
  const syy = (s: number): number => MT + (5 - s) * sh;
  const els: React.ReactNode[] = [];

  for (let f = 0; f <= FR; f++) {
    els.push(
      <line
        key={'v' + f}
        x1={fx(f)}
        y1={MT}
        x2={fx(f)}
        y2={H - MB}
        stroke={f === 0 ? INK : BORDER}
        strokeWidth={f === 0 ? 3 : 1}
      />,
    );
  }
  for (let s = 0; s < 6; s++) {
    els.push(
      <line
        key={'h' + s}
        x1={fx(0)}
        y1={syy(s)}
        x2={fx(FR)}
        y2={syy(s)}
        stroke={BORDER}
        strokeWidth={1}
      />,
    );
  }
  [3, 5, 7, 9, 12].forEach((f) => {
    els.push(
      <text
        key={'l' + f}
        x={fx(f) - fw / 2}
        y={H - 6}
        fontSize={10}
        fill={FAINT}
        textAnchor="middle"
        fontFamily='"JetBrains Mono","D2Coding",ui-monospace,monospace'
      >
        {f}
      </text>,
    );
  });

  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= FR; f++) {
      const pc = (open[s] + f) % 12;
      if (set.has(pc)) {
        const isR = pc === root % 12;
        const cx = f === 0 ? fx(0) - 13 : fx(f) - fw / 2;
        const cy = syy(s);
        els.push(
          <circle
            key={'c' + s + '_' + f}
            data-testid={isR ? 'scale-root' : 'scale-note'}
            cx={cx}
            cy={cy}
            r={9}
            fill={isR ? ACCENT : '#fff'}
            stroke={isR ? ACCENT : INK}
            strokeWidth={1.4}
          />,
        );
        els.push(
          <text
            key={'t' + s + '_' + f}
            x={cx}
            y={cy + 3.4}
            fontSize={8.5}
            fill={isR ? '#fff' : INK}
            textAnchor="middle"
            fontWeight={600}
            fontFamily='"JetBrains Mono","D2Coding",ui-monospace,monospace'
          >
            {noteName(pc)}
          </text>,
        );
      }
    }
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ maxWidth: W, display: 'block' }}
    >
      {els}
    </svg>
  );
}
