// Chordex 브랜드 에셋 생성기 (재현용).
// 픽셀 픽(pick) 아이덴티티: 둥근 픽 실루엣을 정의하고, 경계 셀은 자동으로
// 외곽선 처리한 뒤 sharp로 PNG를 굽는다. 산출물은 @capacitor/assets v3
// 소스 규약(assets/*.png)에 맞춘다.
//   icon-only.png        1024  플레이트+픽 (iOS/레거시)
//   icon-foreground.png  1024  픽만 (Android 적응형 전경, 안전영역 ~66%)
//   icon-background.png  1024  단색 플레이트 (Android 적응형 배경)
//   splash.png           2732  라이트 스플래시
//   splash-dark.png      2732  다크 스플래시
// 사용: `node scripts/generate-brand-assets.mjs` → `npm run cap:assets`.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');

// ── 브랜드 색 (tokens.css 정합) ──
const PLATE = '#0052cc'; // accent blue
const PLATE_DARK = '#06122e'; // deep navy (dark splash)
const COLORS = {
  '#': '#f2b134', // 픽 본체 (amber)
  s: '#d98a1c', // 우/하단 음영 (darker amber)
  o: '#ffe39e', // 하이라이트 (light amber)
  e: '#0a1f44', // 눈/입 (navy)
};

// 16x16 픽 실루엣(물방울형: 둥근 윗부분 → 완만히 좁아지는 점). 'P' = 픽, '.' = 배경.
const SIL = [
  '................',
  '................',
  '.....PPPPPP.....',
  '....PPPPPPPP....',
  '...PPPPPPPPPP...',
  '...PPPPPPPPPP...',
  '...PPPPPPPPPP...',
  '....PPPPPPPP....',
  '....PPPPPPPP....',
  '.....PPPPPP.....',
  '.....PPPPPP.....',
  '......PPPP......',
  '......PPPP......',
  '.......PP.......',
  '................',
  '................',
];
const FACE = [[6, 6], [6, 9], [8, 7], [8, 8]]; // 눈 둘 + 평평한 입(ㅡ, 안 웃음)
const HILITE = [[4, 4], [4, 5], [5, 4]]; // 좌상단 광택
const GRID = SIL.length; // 16

const isP = (r, c) => r >= 0 && r < GRID && c >= 0 && c < GRID && SIL[r][c] === 'P';

// 셀 타입 격자: P=솔리드 본체(#), 우/하단 경계=음영(s, 픽셀 입체감),
// 이후 하이라이트(o)·얼굴(e) 덮어쓰기. 외곽선은 두지 않는다 — 파란 플레이트
// 대비로 실루엣이 또렷하고, 얇은 음영만으로 픽처럼 읽힌다.
function cellTypes() {
  const g = Array.from({ length: GRID }, () => Array(GRID).fill('.'));
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!isP(r, c)) continue;
      const shade = !isP(r + 1, c) || !isP(r, c + 1); // 아래/오른쪽 가장자리
      g[r][c] = shade ? 's' : '#';
    }
  }
  for (const [r, c] of HILITE) if (g[r][c] === '#') g[r][c] = 'o';
  for (const [r, c] of FACE) if (isP(r, c)) g[r][c] = 'e';
  return g;
}

function bbox(g) {
  let minR = GRID, maxR = -1, minC = GRID, maxC = -1;
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (g[r][c] !== '.') {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
  return { minR, maxR, minC, maxC, w: maxC - minC + 1, h: maxR - minR + 1 };
}

// 픽을 size 캔버스의 frac 비율로 중앙 배치한 SVG. bg=null이면 투명(전경 레이어).
function svg(size, frac, bg) {
  const g = cellTypes();
  const b = bbox(g);
  const cell = Math.max(1, Math.floor((frac * size) / Math.max(b.w, b.h)));
  const pickW = b.w * cell;
  const pickH = b.h * cell;
  const offX = Math.round((size - pickW) / 2);
  const offY = Math.round((size - pickH) / 2);
  let rects = '';
  for (let r = b.minR; r <= b.maxR; r++) {
    for (let c = b.minC; c <= b.maxC; c++) {
      const ch = g[r][c];
      if (ch === '.') continue;
      const x = offX + (c - b.minC) * cell;
      const y = offY + (r - b.minR) * cell;
      rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${COLORS[ch]}"/>`;
    }
  }
  const bgRect = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${bgRect}${rects}</svg>`;
}

async function png(name, markup) {
  await sharp(Buffer.from(markup)).png().toFile(join(OUT, name));
  console.log('wrote', name);
}

await mkdir(OUT, { recursive: true });
await png('icon-only.png', svg(1024, 0.74, PLATE)); // iOS/레거시: 플레이트+픽
// 적응형 전경: 안전영역 크기(~0.60)를 소스에 반영. 후처리(patch-android-adaptive.mjs)가
// capacitor-assets의 16.7% inset을 제거하고 배경을 풀블리드 @color로 바꾼다.
await png('icon-foreground.png', svg(1024, 0.6, null));
await png('splash.png', svg(2732, 0.22, PLATE));
await png('splash-dark.png', svg(2732, 0.22, PLATE_DARK));
console.log('done →', OUT);
