// cap:assets 후처리 — Android 적응형(adaptive) 아이콘을 풀블리드로 교정.
//
// 왜: capacitor-assets 기본 출력은 배경 PNG를 16.7% inset한다. 그러면 적응형
// 배경이 108dp 캔버스를 다 못 채워, 큰 마스크(예: 삼성 라운드 사각형)를 쓰는
// 런처에서 모서리가 투명하게 비친다. 또 전경까지 inset돼 픽이 과하게 작아진다.
//
// 교정: 배경은 단색 @color(풀블리드)로, 전경은 inset 없이 그대로 쓴다.
// 전경 소스(icon-foreground.png)에 이미 안전영역 크기(frac ~0.60)를 반영했다.
// package.json의 `cap:assets`가 generate 직후 이 스크립트를 실행한다(재현 가능).
import { writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RES = join(dirname(fileURLToPath(import.meta.url)), '..', 'android', 'app', 'src', 'main', 'res');
const BRAND = '#0052CC'; // tokens.css --c-accent (적응형 배경)

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
const colorXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND}</color>
</resources>
`;

await writeFile(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
await writeFile(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
await writeFile(join(RES, 'values', 'ic_launcher_background.xml'), colorXml);

// 풀블리드 @color 배경을 쓰므로 inset용 배경 PNG는 불필요 → 제거.
for (const d of ['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  await rm(join(RES, `mipmap-${d}`, 'ic_launcher_background.png'), { force: true });
}
console.log('patched adaptive icons → full-bleed @color background (' + BRAND + ')');
