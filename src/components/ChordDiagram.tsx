import { computeDiagram } from '../domain/diagram';
import { noteName } from '../domain/notes';
import { OPENPC } from '../domain/constants';
import type { DiagramVariant, FretArray } from '../domain/types';

interface ChordDiagramProps {
  frets: FretArray;
  width: number;
  variant?: DiagramVariant;
}

// 색 상수 (원본 colors() + tokens). SVG attr는 CSS var 대신 직접 값 사용(렌더 안정성).
const INK = '#000';
const FAINT = '#9a9893';
const GC = '#9c9a94';

const VB = 104;
const VH = 136;
const nutY = 30;
const bottom = 126;
const fretH = (bottom - nutY) / 5;
const markerY = 14;

/**
 * 코드 다이어그램 SVG. (원본 diagramEl 라인 402-413 / diagramTone 라인 349-360)
 *  - dots: 점만, start>1이면 좌측 라벨
 *  - tones: 점 위 음이름(흰색), 각 행 프렛번호
 */
export function ChordDiagram({ frets, width, variant = 'dots' }: ChordDiagramProps) {
  const g = computeDiagram(frets);
  const isTones = variant === 'tones';
  const ML = isTones ? 22 : 20;
  const gap = (VB - (isTones ? 40 : 38)) / 5;
  const r = isTones ? 7.6 : 6.4;

  const sx = (i: number): number => ML + i * gap;
  const fy = (row: number): number => nutY + row * fretH;
  const dy = (row: number): number => nutY + (row - 0.5) * fretH;

  const els: React.ReactNode[] = [];

  // 프렛 가로선 (0행은 너트일 수 있음)
  for (let row = 0; row <= 5; row++) {
    const isNut = row === 0 && g.showNut;
    els.push(
      <line
        key={'f' + row}
        data-testid={isNut ? 'diagram-nut' : undefined}
        x1={sx(0)}
        y1={fy(row)}
        x2={sx(5)}
        y2={fy(row)}
        stroke={isNut ? INK : GC}
        strokeWidth={isNut ? 3 : 1.3}
      />,
    );
  }
  // 현 세로선
  for (let s = 0; s < 6; s++) {
    els.push(
      <line
        key={'s' + s}
        x1={sx(s)}
        y1={nutY}
        x2={sx(s)}
        y2={bottom}
        stroke={GC}
        strokeWidth={1.3}
      />,
    );
  }

  if (isTones) {
    // 각 행 프렛 번호
    for (let row = 1; row <= 5; row++) {
      const fn = g.start + row - 1;
      els.push(
        <text
          key={'fn' + row}
          x={sx(0) - 7}
          y={dy(row) + 3}
          fontSize={8}
          fill={FAINT}
          textAnchor="end"
          fontFamily='"JetBrains Mono",monospace'
        >
          {fn}
        </text>,
      );
    }
  } else if (!g.showNut) {
    // dots: 너트가 아니면 시작 프렛 좌측 라벨
    els.push(
      <text
        key="pos"
        data-testid="diagram-poslabel"
        x={sx(0) - 7}
        y={dy(1) + 3}
        fontSize={9}
        fill={FAINT}
        textAnchor="end"
        fontFamily='"JetBrains Mono","D2Coding",ui-monospace,monospace'
      >
        {g.start}
      </text>,
    );
  }

  // 마커 (뮤트 ×, 오픈 ○)
  g.markers.forEach((m, i) => {
    if (m.type === 'open') {
      els.push(
        <circle
          key={'m' + i}
          data-testid="diagram-open"
          cx={sx(m.s)}
          cy={markerY}
          r={3.6}
          fill="none"
          stroke={FAINT}
          strokeWidth={1.4}
        />,
      );
    } else {
      els.push(
        <text
          key={'m' + i}
          data-testid="diagram-mute"
          x={sx(m.s)}
          y={markerY + 4}
          fontSize={12}
          fill={FAINT}
          textAnchor="middle"
          fontFamily='"JetBrains Mono","D2Coding",ui-monospace,monospace'
        >
          ×
        </text>,
      );
    }
  });

  // 운지 점
  g.dots.forEach((d, i) => {
    els.push(
      <circle
        key={'d' + i}
        data-testid="diagram-dot"
        cx={sx(d.s)}
        cy={dy(d.row)}
        r={r}
        fill={INK}
      />,
    );
    if (isTones) {
      const fret = frets[d.s];
      const note = noteName((OPENPC[d.s] + (fret as number)) % 12);
      els.push(
        <text
          key={'dt' + i}
          x={sx(d.s)}
          y={dy(d.row) + 2.6}
          fontSize={6.6}
          fill="#fff"
          textAnchor="middle"
          fontWeight={700}
          fontFamily='"JetBrains Mono",monospace'
        >
          {note}
        </text>,
      );
    }
  });

  return (
    <svg
      width={width}
      height={Math.round((width * VH) / VB)}
      viewBox={`0 0 ${VB} ${VH}`}
      style={{ display: 'block' }}
    >
      {els}
    </svg>
  );
}
