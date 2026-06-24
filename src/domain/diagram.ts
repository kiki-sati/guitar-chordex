import type {
  DiagramDot,
  DiagramGeometry,
  DiagramMarker,
  FretArray,
} from './types';

/**
 * 다이어그램 기하 분류. (원본 라인 393-401)
 *  - start: fretted 중 max>5일 때만 mn 기준 이동, 아니면 1.
 *  - showNut: start===1
 *  - dots/markers: 'x'→mute, 0→open, else dot {s,row:f-start+1}
 */
export function computeDiagram(frets: FretArray): DiagramGeometry {
  const nums = frets.map((f) => (f === 'x' ? 'x' : f));
  const fretted = nums.filter((f): f is number => f !== 'x' && f > 0);
  let start = 1;
  const span = 5;
  if (fretted.length) {
    const mx = Math.max(...fretted);
    const mn = Math.min(...fretted);
    if (mx > 5) start = Math.max(1, mn);
  }
  const dots: DiagramDot[] = [];
  const markers: DiagramMarker[] = [];
  nums.forEach((f, i) => {
    if (f === 'x') markers.push({ s: i, type: 'mute' });
    else if (f === 0) markers.push({ s: i, type: 'open' });
    else dots.push({ s: i, row: f - start + 1 });
  });
  return { start, span, showNut: start === 1, dots, markers };
}
