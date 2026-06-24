# 기능 설계 계획: 코드살롱 (guitar-chordex) MVP

> 작성: architect · 2026-06-24 · 단일 입력원(source of truth): implementer/qa-verifier는 이 문서를 기준으로 작업한다.
> 디자인 SoT: `_workspace/00_input/design/기타 코드 연습 Figma.dc.html` (847줄, 전체 정독 완료). 프로토타입은 React.createElement + 인라인 스타일이지만, **시각 결과를 재현**하되 대상 스택(React/TS + CSS Modules)으로 재구현한다.
> 도메인 엔진(상수/알고리즘/기하)은 음악적 정확성이 핵심 → **수치/로직 그대로 이식**.

---

## 0. 핵심 설계 결정 요약 (먼저 읽기)

1. **그린필드** — Vite + React + TS + Vitest로 스캐폴딩. 작업 루트 `C:/Users/plgrim/kiki/study_workspace/guitar-chordex/`. `guitar-chordex-/` 빈 폴더는 무시.
2. **도메인/UI 완전 분리** — 모든 음악 로직은 `src/domain/`(순수 함수, React 무의존). 원본의 `DCLogic` 클래스 메서드를 순수 함수 모듈로 분해. UI는 `src/components/`(위젯) + `src/views/`(6뷰 중 MVP 4뷰).
3. **MVP 4뷰**: 홈 · 코드 사전 · 스케일 · 연습 기록. **악보/레슨 네비는 표시하되 비활성(disabled)** — 원본 navDefs 6개를 유지하되 builder/lesson은 `disabled:true`로 클릭 불가 + 흐리게. (숨김보다 비활성 선택 이유: 후속 확장 자리를 시각적으로 예약, 디자인의 사이드바 6항목 비주얼 유지.)
4. **상태 관리**: 최상위 단일 `useReducer`(`src/state/appReducer.ts`) + Context. 원본의 `this.state` 평면 객체를 그대로 reducer state로. localStorage 영속화는 reducer 외부 미들웨어 형태(`persist` 헬퍼)로 분리.
5. **MVP 제외 기능의 상태 슬롯은 유지** — `collected`, `sequence`, `lessons` 등 상태 필드는 타입에 남기되 UI만 미구현. 후속에서 뷰만 붙이면 됨.
6. **재생/복사 버튼**: 오디오·canvas 후속이므로 MVP에서 **DOM 자리는 두되 비활성**(또는 카드에서 담기/모든폼만 노출). 결정 → §5.4 참조.
7. **다이어그램 SVG 기하 상수 그대로 이식**: `VB=104, VH=136`, 마진/간격/반지름 등 전부 §4.7 표로 고정.
8. **디자인 토큰**: `src/styles/tokens.css`의 CSS 변수로. 원본 `colors()`의 accent 기본값은 `#0052cc`이나, DESIGN-figma.md 시스템 정체성은 모노크롬(ink=#000)이며 원본 `this.props.accentColor` 기본도 코드상 `#0052cc`. → **accent = `#0052cc` 고정** (잔디 GLEVELS는 별도 고정 팔레트). soft = accent + `14`(8% 알파).

---

## 1. 수용 기준 (Acceptance Criteria — 정련 체크리스트)

request.md의 기준을 검증 가능한 단위로 분해. `[QA]` = qa-verifier 검증 경계면 연결.

### AC-S 앱 셸 / 네비게이션
- [ ] S1. 좌측 사이드바: 브랜드(🎸 코드살롱) + 네비(홈·코드 사전·스케일·연습 기록 활성, 악보·레슨 비활성) + 푸터(이번 주 카운트 `weekCount` + `weekMeta`).
- [ ] S2. 메인 헤더: eyebrow(mono 대문자) + 타이틀 + 스트릭 칩(🔥 `streakChip`) + "오늘 연습 기록" 버튼(클릭 시 `logPractice`).
- [ ] S3. 네비 클릭 시 4개 뷰 전환. 활성 항목은 검정 배경/흰 텍스트(원본 navItems style).
- [ ] S4. 반응형: ≤820px 사이드바 가로 전환(라벨 텍스트 숨김, 푸터 숨김), ≤600px 패딩 축소, ≤440px 스트릭칩/브랜드텍스트 숨김. (원본 @media 규칙 §7.3 그대로.)
- [ ] S5. KO/EN 토글은 **MVP에서 KO 고정 표시**(EN 후속). 버튼 자리는 두되 EN 클릭 시 동작 없음 또는 토글 숨김 — §9 i18n 참조.

### AC-D 코드 사전
- [ ] D1. 모드 토글: 키별(다이어토닉) / 루트별. `dictMode` 전환.
- [ ] D2. 키별: 루트 12음 pill + Major/Minor 탭 → `diatonic(root,type)` 7코드를 로마숫자와 함께 그리드 표시. [QA: diatonic 매핑]
- [ ] D3. 루트별: QGROUPS 7그룹(트라이어드~서스펜디드)별 코드 그리드. 각 그룹 라벨(mono) + 루트명. [QA: QGROUPS quals]
- [ ] D4. 검색: 입력 시 12루트×전체 QUALS 중 이름 매칭(♭→b, ♯→# 정규화). 결과 개수 표시. 무결과 메시지. [QA: 검색 정규화]
- [ ] D5. 코드 카드: (로마숫자) + 코드명 + 다이어그램 SVG + 액션 버튼(담기/모든폼). [QA: chordCard props]
- [ ] D6. "모든 폼" 클릭 → 상세 모달: `allVoicings` 보이싱 그리드 + 구성음 태그(INTERVALS 기반). 배경 클릭/X로 닫힘. [QA: allVoicings, detailView]

### AC-G 다이어그램 렌더 (SVG, 도메인 핵심)
- [ ] G1. 6현 세로선, 5프렛 가로선, 1프렛 시작 시 너트(굵은 검정선).
- [ ] G2. 마커: 뮤트(×), 오픈(○) — 줄 상단 markerY.
- [ ] G3. 운지 점(검정 원). 카드용 `diagramEl`은 점만, 모달용 `diagramTone`은 점 위 음이름 텍스트(흰색).
- [ ] G4. 시작 프렛 표기: `diagramEl`은 start>1이면 좌측 라벨, `diagramTone`은 각 행 프렛번호. [QA: computeDiagram start/showNut]

### AC-C 스케일
- [ ] C1. 스케일 탭 5종(메이저/마이너/메이저펜타/마이너펜타/블루스), 루트 12음 pill.
- [ ] C2. 지판(12프렛) 전체에 스케일 구성음 원 표시, 루트는 accent 채움. [QA: scaleNotes, fretboardEl 기하]
- [ ] C3. 구성음 칩(R, 2, 3…) + 범례(루트음/스케일 구성음).

### AC-P 연습 기록
- [ ] P1. 통계 카드 4개: 연속(streak)/총일수(days)/이번주(week)/누적(total). [QA: stats]
- [ ] P2. 드릴 체크리스트: 목표 횟수만큼 원형 스탬프 채우기, 목표 ±, 추가/삭제, "체크 비우기". 목표 달성(count≥target) 순간 잔디+1 + 토스트. [QA: setDrillCount 부수효과]
- [ ] P3. 연습 잔디: GitHub식 1년(53주×7일) 히트맵 + 범례 + "오늘 연습 기록" 버튼. [QA: buildGrass, level]
- [ ] P4. 연습 일지: 작성 폼(제목/분/코드/메모) → 추가 시 일지 카드 prepend + 잔디+1. 카드 리스트. [QA: addJournal]
- [ ] P5. 시드 데이터: 첫 방문 시 잔디/일지/드릴 예시 채움. (localStorage 없을 때만.) [QA: seed 함수]
- [ ] P6. 모든 변경이 localStorage(`cs_grass`/`cs_journal`/`cs_drills`/`cs_collected`)에 영속. 새로고침 유지. [QA: persist]

### AC-H 홈
- [ ] H1. 레이아웃 토글: focus(필수) + board + minimal. `homeLayout` 세그.
- [ ] H2. focus: 스트릭 카드(연한 라임 `#e8f2d2`) + 잔디 카드 + 오늘의 추천 코드 그리드(다이어그램).
- [ ] H3. board/minimal: 원본 그리드 구성 재현(잔디/연속/최근일지/담은코드 등). collected 표시 포함.

### AC-X 도메인 엔진 (테스트 대상)
- [ ] X1. 상수(NOTE/SUF/INTERVALS/QUALS/QGROUPS/OPEN/BARRE_OK/scaleDefs/GLEVELS/OPENPC) TS 이식. [QA: 상수 무결성]
- [ ] X2. `buildChord` 우선순위(OPEN→m7b5→BARRE_OK→bestVoicing) Vitest 통과. [QA]
- [ ] X3. `bestVoicing`/`allVoicings`/`requiredPCs`/`_enumBase`/`_collect` 결과가 음악적으로 타당(필수음 포함, 운지폭≤4, 베이스 스코어링). [QA]
- [ ] X4. `diatonic`/`scaleNotes`/`computeDiagram`/`stats`/`buildGrass`/`level`/`dateStr` 단위 테스트. [QA]

### AC-B 빌드/품질
- [ ] B1. `npm run build` 통과 (tsc + vite build).
- [ ] B2. `npm test` (vitest run) 통과 — 도메인 모듈 커버.
- [ ] B3. 컴포넌트(뷰/위젯)와 도메인 로직이 디렉터리로 분리.

---

## 2. 디렉터리 / 파일 구조

```
guitar-chordex/
├─ index.html                      # Vite 진입, 폰트 preconnect(Inter/JetBrains Mono/D2Coding)
├─ package.json
├─ tsconfig.json / tsconfig.node.json
├─ vite.config.ts                  # vitest 설정 포함 (test.environment='jsdom', globals)
├─ vitest.setup.ts                 # @testing-library/jest-dom, localStorage mock
├─ src/
│  ├─ main.tsx                     # createRoot → <App/>
│  ├─ App.tsx                      # 셸: AppProvider + Sidebar + Header + view 라우팅 + Toast + Modal
│  │
│  ├─ domain/                      # ── 순수 도메인 (React 무의존, 테스트 1급 대상) ──
│  │  ├─ constants.ts              # NOTE, SUF, INTERVALS, QUALS, QGROUPS, OPEN, BARRE_OK,
│  │  │                            #   scaleDefs, scaleLabels(+En), GLEVELS, OPENPC, OPEN_MIDI
│  │  ├─ types.ts                  # 도메인 타입 (§3)
│  │  ├─ notes.ts                  # noteName, dateStr, normalizeQuery
│  │  ├─ chord.ts                  # buildChord, barre, chordPCs, requiredPCs
│  │  ├─ voicing.ts                # _enumBase, _collect, bestVoicing, allVoicings (메모 캐시)
│  │  ├─ diatonic.ts               # diatonic
│  │  ├─ scale.ts                  # scaleNotes
│  │  ├─ diagram.ts                # computeDiagram (기하 분류만; SVG 렌더는 컴포넌트)
│  │  ├─ practice.ts               # stats, level, buildGrass
│  │  └─ index.ts                  # 재노출(barrel)
│  │
│  │  └─ __tests__/                # *.test.ts (Vitest)
│  │     ├─ chord.test.ts
│  │     ├─ voicing.test.ts
│  │     ├─ diatonic.test.ts
│  │     ├─ scale.test.ts
│  │     ├─ diagram.test.ts
│  │     └─ practice.test.ts
│  │
│  ├─ state/
│  │  ├─ appReducer.ts             # AppState, Action, reducer (§6)
│  │  ├─ AppContext.tsx            # Context + Provider + useApp() 훅
│  │  ├─ persist.ts               # load()/save() localStorage (cs_* 키)
│  │  └─ seed.ts                   # seedGrass, seedJournal, seedDrills, seedCollected
│  │
│  ├─ components/                  # ── 재사용 위젯 ──
│  │  ├─ Sidebar.tsx + .module.css
│  │  ├─ Header.tsx + .module.css
│  │  ├─ Toast.tsx + .module.css
│  │  ├─ Segmented.tsx + .module.css   # pill 세그 토글 (dictMode/keyType/scaleTabs/homeLayout)
│  │  ├─ RootPills.tsx + .module.css   # 12음 루트 선택 pill
│  │  ├─ ChordDiagram.tsx + .module.css# SVG 다이어그램 (variant: 'dots' | 'tones')
│  │  ├─ ChordCard.tsx + .module.css
│  │  ├─ ChordDetailModal.tsx + .module.css
│  │  ├─ Fretboard.tsx + .module.css   # 스케일 12프렛 지판 SVG
│  │  ├─ GrassHeatmap.tsx + .module.css# 잔디 + Legend
│  │  ├─ StatCard.tsx + .module.css
│  │  ├─ DrillList.tsx + .module.css
│  │  ├─ JournalForm.tsx + .module.css
│  │  └─ JournalCard.tsx + .module.css
│  │
│  ├─ views/                       # ── 뷰(페이지) ──
│  │  ├─ HomeView.tsx + .module.css
│  │  ├─ DictionaryView.tsx + .module.css
│  │  ├─ ScalesView.tsx + .module.css
│  │  └─ PracticeView.tsx + .module.css
│  │  (BuilderView/LessonView = 후속, 파일 미생성)
│  │
│  ├─ i18n/
│  │  └─ strings.ts                # L(ko,en) 대체: ko 문자열 맵 + lang 게이트 (§9)
│  │
│  └─ styles/
│     ├─ tokens.css                # :root CSS 변수 (색/폰트/라운딩/간격)
│     └─ global.css                # reset, body 폰트, scrollbar, @keyframes toastIn, @media
└─ _workspace/ …
```

**스캐폴딩 명령**: `npm create vite@latest . -- --template react-ts` 후 추가 의존성:
`npm i -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`.
런타임 추가 의존성 없음(React만).

---

## 3. 도메인 데이터 모델 & TypeScript 타입 (`src/domain/types.ts`)

> 음악적으로 불가능한 상태를 타입으로 차단. **단, 원본 알고리즘과의 호환을 위해 fret은 `number | 'x'` 유니온 유지**(원본은 'x' 문자열·0·양수 혼용). 0=개방현, 'x'=뮤트, 양수=프렛.

```typescript
// ── 음이름 / 피치클래스 ──
export type Note =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export type PitchClass = number;        // 0..11
export type RootIndex = number;          // 0..11 (NOTE 인덱스)

// ── 코드 퀄리티 (QUALS 키와 동일한 리터럴 유니온; SUF/INTERVALS 키와 1:1) ──
export type Quality =
  | 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'majb5' | 'm#5' | 'mbb5'
  | 'sus4#5' | 'sus2b5' | 'sus2#5' | '7' | 'm7' | 'maj7' | 'mMaj7' | 'dim7'
  | 'aug7' | 'augMaj7' | '7b5' | 'maj7b5' | 'm7b5' | 'mMaj7b5' | 'mMaj7bb5'
  | 'm7#5' | 'mMaj7#5' | '7b9' | '6' | 'm6' | '6b5' | '6add9' | 'm6add9'
  | '9' | 'm9' | 'maj9' | 'mMaj9' | '9b5' | 'aug9' | '9sus4' | '7#9' | '7#9b5'
  | 'augMaj9' | 'add9' | '11' | 'm11' | 'maj11' | 'mMaj11' | 'maj#11'
  | '13' | 'm13' | 'maj13' | 'mMaj13' | '7sus2' | 'maj7sus2' | '7sus4'
  | 'maj7sus4' | '7sus2#5' | '7sus4#5';

// ── 한 줄 운지: 'x'=뮤트, 0=개방현, 양수=프렛 ──
export type Fret = number | 'x';
// 6현, 인덱스 0=6번줄(저음 E), …, 5=1번줄(고음 e)  ← 원본 frets 배열 순서
export type FretArray = Fret[];          // 항상 length 6 (런타임 보장)

// ── 코드 (buildChord 반환) ──
export interface Chord {
  name: string;          // 예: 'Cmaj7' (noteName + SUF[qual])
  frets: FretArray;      // 6칸
  root: RootIndex;       // 0..11
  qualKey: Quality;
  key: string;           // = name (리스트 key 용도, 원본 호환)
  roman?: string;        // diatonic()에서만 부여 (예: 'Imaj7')
}

// ── 보이싱 후보 (내부 _collect 결과) ──
export interface VoicingCandidate {
  frets: FretArray;
  pos: number;           // 다이어그램 시작 프렛 기준 위치 (mx>0?mn:0)
  score: number;         // 낮을수록 우수
}

// ── 다이어그램 기하 (computeDiagram 반환) ──
export interface DiagramMarker { s: number; type: 'mute' | 'open'; }  // s=현 인덱스 0..5
export interface DiagramDot { s: number; row: number; }               // row=1..5 (start 기준)
export interface DiagramGeometry {
  start: number;         // 시작 프렛 (1 또는 mn)
  span: number;          // 5 고정
  showNut: boolean;      // start===1
  dots: DiagramDot[];
  markers: DiagramMarker[];
}

// ── 스케일 ──
export type ScaleType = 'major' | 'minor' | 'majpent' | 'minpent' | 'blues';

// ── 다이어토닉 키 타입 ──
export type KeyType = 'major' | 'minor';

// ── 연습 기록 도메인 ──
export type GrassMap = Record<string, number>;   // 'YYYY-MM-DD' → 횟수
export interface GrassDay { ds: string; count: number; level: 0|1|2|3|4; date: Date; }
export type GrassWeek = (GrassDay | null)[];      // 길이 7 (요일)

export interface Stats { total: number; days: number; streak: number; week: number; }

export interface Drill {
  id: string;
  title: string;
  target: number;        // 1..40
  count: number;         // 0..
  seq?: { name: string; frets: FretArray }[]; // 후속(악보 연동) 슬롯
  sheetId?: string;      // 후속 슬롯
  timeSig?: string;      // 후속 슬롯
}

export interface JournalEntry {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  title: string;
  minutes: number;
  chords: string[];      // 코드명 문자열
  notes: string;
}

// ── 담은 코드 (collected; 후속 악보용이나 board/minimal 홈에서 표시) ──
export interface CollectedChord { name: string; frets: FretArray; key: string; }

// ── 다이어그램 렌더 variant ──
export type DiagramVariant = 'dots' | 'tones';
```

**불가능 상태 차단 원칙**:
- `Quality`/`ScaleType`/`KeyType`를 리터럴 유니온으로 좁혀 오타·미정의 퀄리티 차단.
- `INTERVALS`/`SUF`는 `Record<Quality, number[]>` / `Record<Quality, string>`로 타이핑 → 모든 Quality에 정의 강제(컴파일 타임 누락 검출).
- `FretArray`는 길이 6을 런타임 단언(`buildChord`/`barre` 출력 검증 테스트로 보장). 타입상 튜플(`[Fret,Fret,Fret,Fret,Fret,Fret]`) 사용도 가능하나, `.map`/`.slice` 반환이 일반 배열이 되어 알고리즘 호환성↓ → **일반 배열 + 테스트 보장** 채택.

---

## 4. 도메인 함수 시그니처 & 원본 로직 명세

> 모든 함수는 **순수**(상태 무의존). 원본에서 `this.NOTE` 등 인스턴스 참조는 import 상수로 치환. 미묘한 로직은 **반드시 그대로 이식** — 아래 명세가 곧 테스트 케이스다.

### 4.1 상수 (`constants.ts`) — 원본 라인 그대로 복사
- `NOTE` (12), `SUF`(Record<Quality,string>), `INTERVALS`(Record<Quality,number[]>), `QUALS`(Quality[]), `QGROUPS`(7그룹), `BARRE_OK`(Set<Quality>: maj/min/7/maj7/m7/sus4), `OPEN`(오픈코드 맵, 키=`'C|maj'` 등), `scaleDefs`, `scaleLabels`/`scaleLabelsEn`, `GLEVELS`(5색), `OPENPC=[4,9,2,7,11,4]`(개방현 피치클래스, 6→1번줄), `OPEN_MIDI=[40,45,50,55,59,64]`(보이싱 enum·오디오용 MIDI).
- **주의**: `OPENPC`(다이어그램 음이름용)와 `OPEN_MIDI`(보이싱/오디오용)는 별개. 원본 `_enumBase`·`_collect`는 `OPEN=[40,45,50,55,59,64]`(MIDI) 사용, `diagramTone`·`fretboardEl`은 `OPENPC`/`[40..64]` 혼용 → 분리 명명.

### 4.2 `notes.ts`
```typescript
noteName(i: number): Note          // NOTE[((i%12)+12)%12]
dateStr(d: Date): string           // 'YYYY-MM-DD' (월/일 padStart 2)
normalizeQuery(s: string): string  // toLowerCase + ♭→b + ♯→#  (검색용)
```

### 4.3 `chord.ts`
```typescript
buildChord(ni: RootIndex, qual: Quality): Chord
```
**우선순위(엄수)**: ① `key = noteName(ni)+'|'+qual` 가 `OPEN`에 있으면 `OPEN[key].slice()`. ② `qual==='m7b5'` 특수: `n=((ni-9)+12)%12; frets=['x',n,n+1,n,n+1,'x']`. ③ `BARRE_OK.has(qual)` → `barre(ni,qual)`. ④ else `bestVoicing(ni,qual)`. 반환 `{name, frets, root:ni, qualKey:qual, key:name}`. name = `noteName(ni)+(SUF[qual]||'')`.

```typescript
barre(ni: RootIndex, qual: Quality): FretArray
```
**E/A shape 선택(엄수)**: `eBase=((ni-4)+12)%12, aBase=((ni-9)+12)%12, useA=false, base=eBase`. `if(eBase===0){ if(aBase>0){useA=true;base=aBase;} }` `else if(aBase>0 && aBase<eBase){ useA=true; base=aBase; }`. shape = useA?A[qual]:E[qual]. 반환 `shape.map(v=> v==='x'?'x': base+v)`. (E/A shape 테이블은 함수 내부 상수로, 원본 라인 304-305 그대로.)

```typescript
chordPCs(root, qual): Set<PitchClass>     // INTERVALS[qual]||[0,4,7] 의 (root+i)%12 집합
requiredPCs(root, qual): Set<PitchClass>
```
**requiredPCs 핵심(엄수)**: `sem = [...new Set((INTERVALS[qual]||[0,4,7]).map(i=>i%12))]`. `drop=[7,2,5]`(완전5도→9도→4도/11도 순). `while(sem.length>4 && i<drop.length){ sem=sem.filter(x=>x!==drop[i]); i++; }`. 그래도 >4면 `sem.slice(0,4)`. 반환 = `(root+s)%12` 집합. → **필수 구성음을 최대 4개로 제한, drop 순서 7→2→5**.

### 4.4 `voicing.ts` (메모 캐시 모듈 스코프)
```typescript
_enumBase(base, full: Set<PC>, req: Set<PC>, rootPc): VoicingCandidate[]
```
원본 라인 315-321: `OPEN_MIDI=[40,45,50,55,59,64]`. 각 현 s에 대해 후보 옵션 `['x', ...]`: base>0이면 0(개방) 추가, `f∈[max(0,base), base+4)` 중 `full.has((OPEN_MIDI[s]+f)%12)`인 f. 6중 재귀로 모든 조합 생성 → 각 조합을 `_collect`로 평가.

```typescript
_collect(frets, req, rootPc, OPEN_MIDI, out: VoicingCandidate[]): void
```
**필터·스코어(엄수, 라인 322-333)**:
1. 비뮤트 현의 first/last/cnt 계산. `cnt<4` → reject.
2. first~last 사이에 'x' 있으면 reject(연속 보이싱만).
3. first~last 중 f>0의 mn/mx. `mx>0 && mx-mn>4` → reject(운지폭 4프렛 초과 금지).
4. first~last의 피치클래스 집합 pcs. req의 모든 음이 pcs에 없으면 reject.
5. `bassPc=(OPEN_MIDI[first]+frets[first])%12`. `pos = mx>0?mn:0`.
6. **score**: `0`; `bassPc!==rootPc` → `+4`(베이스가 루트 아니면 페널티); `+= (6-cnt)`(적게 누른 현 페널티); `mx>0` → `+= (mx-mn)*0.3`(운지폭 페널티). push `{frets:slice, pos, score}`.

```typescript
bestVoicing(root, qual): FretArray
```
캐시키 `'b'+root+'|'+qual`. full/req/rootPc 계산. `for base 0..10`: `_enumBase`로 후보, score 최소 갱신. **`if(best) break`** — 가장 낮은 base에서 후보가 나오면 즉시 중단(낮은 포지션 우선). 없으면 `['x'×6]`.

```typescript
allVoicings(root, qual): FretArray[]
```
캐시키 `'a'+root+'|'+qual`. `for base 0..11`: 후보를 `byPos[v.pos]`에 score 최소로 보관. `Object.values(byPos).sort((a,b)=>a.pos-b.pos||a.score-b.score).slice(0,10).map(v=>v.frets)`. → 포지션별 최선 1개씩, 최대 10폼.

> **캐시 주의**: 원본은 인스턴스 `this._vc`. 모듈 스코프 `Map`으로 구현하되, **순수성 유지 위해 입력 동일 → 출력 동일**이 보장되므로 메모이제이션 캐시는 허용. 테스트는 캐시 영향 없이 동일 결과 확인.

### 4.5 `diatonic.ts`
```typescript
diatonic(rootIdx, type: KeyType): Chord[]   // length 7
```
원본 라인 383-389. majSteps=[0,2,4,5,7,9,11], minSteps=[0,2,3,5,7,8,10]. majQ=['maj7','m7','m7','maj7','7','m7','m7b5'], majR=['Imaj7','ii m7','iii m7','IV maj7','V7','vi m7','viiø']. minQ=['m7','m7b5','maj7','m7','m7','maj7','7'], minR=['i m7','iiø','♭III maj7','iv m7','v m7','♭VI maj7','♭VII7']. 각 step: `ni=(rootIdx+st)%12`, `buildChord(ni,quals[i])` 에 `{roman:romans[i], key:'d'+i}` Object.assign.

### 4.6 `scale.ts`
```typescript
scaleNotes(root, type: ScaleType): PitchClass[]   // scaleDefs[type].map(s=>(root+s)%12)
```

### 4.7 `diagram.ts`
```typescript
computeDiagram(frets: FretArray): DiagramGeometry
```
원본 라인 393-401. `nums = frets`(그대로). `fretted = nums.filter(f=> f!=='x' && f>0)`. `start=1, span=5`. **start 산정(엄수)**: fretted 있으면 `mx=max, mn=min`; **`if(mx>5) start=max(1,mn)`** (최대 프렛이 5 초과일 때만 mn 기준으로 시작 프렛 이동, 아니면 1프렛 시작). dots/markers 분류: `f==='x'`→mute marker, `f===0`→open marker, else dot `{s:i, row:f-start+1}`. `showNut = start===1`.

> **SVG 렌더 기하 상수(컴포넌트 `ChordDiagram.tsx`로 이식, 원본 diagramEl/diagramTone)**:
> | 상수 | diagramEl(dots) | diagramTone(tones) | 비고 |
> |---|---|---|---|
> | VB / VH (viewBox) | 104 / 136 | 104 / 136 | 동일 |
> | ML (좌마진) | 20 | 22 | tones가 약간 우측 |
> | gap (현 간격) | (VB-38)/5 | (VB-40)/5 | |
> | nutY / bottom | 30 / 126 | 30 / 126 | |
> | fretH | (bottom-nutY)/5 | 동일 | |
> | markerY | 14 | 14 | |
> | 점 반지름 r | 6.4 | 7.6 | tones는 음이름 들어가야 함 |
> | GC(격자색) | '#9c9a94' | '#9c9a94' | |
> | sx(i)=ML+i*gap, fy(r)=nutY+r*fretH, dy(row)=nutY+(row-0.5)*fretH | | | |
> | 너트선 굵기 | r===0&&showNut ? 3 : 1.3 | 동일 | |
> | start 라벨 | showNut 아니면 좌측(fontSize 9) | 각 행 프렛번호(fontSize 8) | tones는 1~5행 모두 |
> | 점 위 텍스트 | 없음 | noteName((OPENPC[s]+frets[s])%12), 흰색 fontSize 6.6 | |
> `<svg width={w} height={Math.round(w*VH/VB)} viewBox="0 0 104 136">`. w는 prop(카드 cardW, 모달 112, board 72/82 등).

### 4.8 `practice.ts`
```typescript
stats(grass: GrassMap): Stats
```
원본 라인 525-529. total/days: g[k]>0인 키 합산·개수. streak: 오늘부터 역순 400일, g>0이면 streak++; `i>0 && g===0`이면 break; i===0(오늘)이고 g===0이면 continue(오늘 미기록이어도 어제부터 streak 인정). week: 최근 7일 합.
```typescript
level(c: number): 0|1|2|3|4   // c<=0?0:c<2?1:c<4?2:c<6?3:4
buildGrass(grass: GrassMap, today=new Date()): GrassWeek[]
```
원본 라인 531-532. start = today - (52*7 + today.getDay())일. cur부터 today까지 7일씩 묶음. cur>today면 null, 아니면 `{ds,count,level,date}`. → 약 53주.

> **시드 함수**는 `state/seed.ts`로(상수 의존하지만 도메인 순수성 약함). `seedGrass`(라인 263-268: 결정론적 해시 `(i*2654435761)%97` + 최근 7일 덮어쓰기), `seedJournal`/`seedDrills`/`seedCollected`(라인 232 collected: `['C|maj','G|maj','A|min','F|maj']`). **MVP는 KO 시드만**(EN 분기 생략 가능).

---

## 5. 컴포넌트 트리 & props 계약 (QA 경계면 기준)

```
<App>                              # AppProvider 안에 셸 배치
 ├─ <Sidebar>
 ├─ <Header>
 ├─ (view switch)
 │   ├─ <HomeView>
 │   │    ├─ <Segmented> (homeLayout)
 │   │    ├─ <GrassHeatmap> + Legend
 │   │    └─ <ChordDiagram> (추천코드들)
 │   ├─ <DictionaryView>
 │   │    ├─ <Segmented> (dictMode), <Segmented> (keyType), search <input>
 │   │    ├─ <RootPills>
 │   │    └─ <ChordCard>* → (클릭) <ChordDetailModal>
 │   ├─ <ScalesView>
 │   │    ├─ <Segmented> (scaleTabs), <RootPills>
 │   │    └─ <Fretboard>
 │   └─ <PracticeView>
 │        ├─ <StatCard>×4
 │        ├─ <DrillList>
 │        ├─ <GrassHeatmap>
 │        ├─ <JournalForm>
 │        └─ <JournalCard>*
 ├─ <ChordDetailModal>  (detailChord 있을 때)
 └─ <Toast>             (toast 있을 때)
```

### 5.1 셸 컴포넌트
```typescript
// Sidebar: 상태는 context에서 직접 구독
interface SidebarProps {}   // 내부에서 useApp() 사용; nav 정의/active/disabled 자체 계산
// nav 항목: {key, label, iconPath, active, disabled}. disabled=builder|lesson.

interface HeaderProps {
  eyebrow: string; title: string;
  streakChip: string;            // 예: '3일 연속'
  onLogPractice: () => void;
  logBtnLabel: string;
}
```

### 5.2 공용 위젯
```typescript
interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'soft' | 'pill';     // soft=라운드 배경 세그(원본 seg), pill 미사용 가능
}
interface RootPillsProps {
  notes: readonly Note[];        // NOTE
  selected: RootIndex;
  onSelect: (i: RootIndex) => void;
}
```

### 5.3 ChordDiagram (경계면 핵심)
```typescript
interface ChordDiagramProps {
  frets: FretArray;              // ← buildChord/voicing 산출
  width: number;                 // px (카드=cardW, 모달=112 …)
  variant?: DiagramVariant;      // 'dots'(기본) | 'tones'
}
// 내부: computeDiagram(frets) → geometry → SVG. tones면 OPENPC로 음이름.
```
[QA 경계면 1]: producer `buildChord(...).frets` (length 6, Fret 유니온) → consumer `ChordDiagram`. `computeDiagram` 출력(start/showNut/dots/markers)이 §4.7 기하로 정확히 렌더되는지.

### 5.4 ChordCard
```typescript
interface ChordCardProps {
  chord: Chord;                  // roman 포함 가능
  cardSize?: 'sm' | 'md' | 'lg'; // 기본 md → width 92/108/128
  onOpenDetail: (chord: Chord) => void;   // 카드/“모든 폼” 클릭
  onCollect: (chord: Chord) => void;      // 담기
  // 후속: onPlay/onCopy — MVP는 버튼 렌더하되 disabled (title='준비 중')
}
```
**재생/복사 결정**: 카드 하단 4버튼(재생/담기/복사/모든폼) 중 **담기·모든폼만 활성**, 재생·복사는 `disabled` 속성 + 흐림(`opacity:.4, cursor:not-allowed`). 비주얼 자리는 유지(후속 손쉬운 활성화). DESIGN 시각 일치 + 후속 슬롯 확보.

### 5.5 ChordDetailModal
```typescript
interface ChordDetailModalProps {
  detail: { root: RootIndex; qualKey: Quality; name: string };
  onClose: () => void;
  onCollect: (c: CollectedChord) => void;
}
// 내부: allVoicings(root,qualKey) → 각 폼 ChordDiagram variant='tones' width=112.
//        구성음 태그 = INTERVALS[qualKey].map(i=>noteName((root+i)%12)).
//        헤더 'ALL VOICINGS · N폼', 폼 라벨 'i · OPEN|Nfr' (computeDiagram.showNut).
//        무결과 시 '이 코드의 표준 폼을 찾지 못했어요.'
```
[QA 경계면 2]: `allVoicings` → modal. 폼 개수·정렬·OPEN/fr 라벨 정확성.

### 5.6 Fretboard (스케일)
```typescript
interface FretboardProps {
  root: RootIndex;
  scaleType: ScaleType;
}
// 내부: scaleNotes → Set. 12프렛 격자. 각 (현,프렛) pc가 set에 있으면 원;
//        루트(pc===root%12)는 accent 채움+흰 텍스트, 그 외 흰 배경+검정 테두리.
//        f===0은 너트 좌측(cx=fx(0)-13). 프렛 마커 라벨 [3,5,7,9,12].
//        기하: FR=12,W=640,H=158,ML=30,MT=16,MB=24 (원본 582-588 그대로).
```
[QA 경계면 3]: `scaleNotes` → Fretboard. 구성음 위치·루트 강조.

### 5.7 GrassHeatmap
```typescript
interface GrassHeatmapProps {
  grass: GrassMap;
  cellSize?: number;             // 기본 11 (board=10, minimal=9)
  showLegend?: boolean;          // 기본 true
}
// 내부: buildGrass(grass) → 주 컬럼들. cell 색 = GLEVELS[level] | transparent.
//        title= 'YYYY-MM-DD · N회'. Legend: '적음' [5색] '많음'.
```
[QA 경계면 4]: `buildGrass`/`level` → Heatmap. 53주 구조·레벨 색.

### 5.8 연습 위젯
```typescript
interface StatCardProps { value: string; label: string; }  // 예: ('3일',' 연속 연습 중')

interface DrillListProps {
  drills: Drill[];
  draftTitle: string; draftTarget: number;
  onSetCount: (id: string, n: number) => void;     // 목표 달성 시 잔디+1은 reducer/handler에서
  onBumpTarget: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onReset: () => void;                              // 체크 비우기
  onAdd: () => void;
  onDraftTitle: (v: string) => void;
  onDraftTarget: (v: number) => void;
}
// 스탬프 클릭 로직(엄수): 인덱스 i 클릭 → setDrillCount(id, (i+1===count)? i : i+1)
//   (마지막 채운 칸 재클릭 시 1 감소, 아니면 i+1로 채움) — 원본 라인 485.

interface JournalFormProps {
  draft: { title: string; minutes: number|string; chords: string; notes: string };
  onChange: (patch: Partial<...>) => void;
  onSubmit: () => void;          // addJournal: 빈 제목 시 토스트, 성공 시 잔디+1
}
interface JournalCardProps { entry: JournalEntry; }
```
[QA 경계면 5]: DrillList `onSetCount` → reducer. count≥target 전이 순간에만 잔디+1 + 토스트(중복 방지: before<target && after>=target).
[QA 경계면 6]: JournalForm `onSubmit` → reducer: 일지 prepend + 잔디+1 + draft 리셋 + persist.

---

## 6. 상태 관리 설계 (`state/`)

### 6.1 AppState (원본 `this.state` → reducer state; MVP 필드만 적극 사용)
```typescript
interface AppState {
  lang: 'ko' | 'en';            // MVP: 'ko' 고정 초기값
  view: 'home'|'dictionary'|'scales'|'practice'|'builder'|'lesson';
  // 사전/스케일
  selectedRoot: RootIndex;      // 0
  keyType: KeyType;             // 'major'
  dictMode: 'key'|'root';       // 'key'
  scaleType: ScaleType;         // 'major'
  query: string;
  // 홈
  homeLayout: 'focus'|'board'|'minimal';  // 'focus'
  // 연습
  grass: GrassMap;
  journal: JournalEntry[];
  drills: Drill[];
  collected: CollectedChord[];  // 표시는 board/minimal 홈; 담기 동작 대상
  // 폼 드래프트
  jTitle: string; jMin: number|string; jChords: string; jNotes: string;
  dTitle: string; dTarget: number;
  // UI 트랜션트
  toast: string;
  detailChord: { root: RootIndex; qualKey: Quality; name: string } | null;
  // ── 후속 슬롯 (타입만 유지, MVP 미사용) ──
  sequence?: ...; sheets?: ...; lessons?: ...; armedChord?: ...; timeSig?: string; sheetTitle?: string;
}
```

### 6.2 Action 유니온 (예시 — 원본 메서드 1:1)
```typescript
type Action =
  | { type: 'SET_VIEW'; view: AppState['view'] }
  | { type: 'SET_ROOT'; root: RootIndex }
  | { type: 'SET_KEY_TYPE'; keyType: KeyType }
  | { type: 'SET_DICT_MODE'; mode: 'key'|'root' }
  | { type: 'SET_SCALE_TYPE'; scaleType: ScaleType }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_HOME_LAYOUT'; layout: AppState['homeLayout'] }
  | { type: 'OPEN_DETAIL'; chord: Chord }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'COLLECT'; chord: CollectedChord }      // 중복 시 토스트(미들웨어/핸들러)
  | { type: 'REMOVE_COLLECTED'; index: number }
  | { type: 'LOG_PRACTICE' }                          // grass[today]+1
  | { type: 'ADD_JOURNAL' }                           // draft → entry + grass+1
  | { type: 'SET_JOURNAL_DRAFT'; patch: Partial<...> }
  | { type: 'ADD_DRILL' } | { type: 'SET_DRILL_COUNT'; id: string; n: number }
  | { type: 'BUMP_DRILL_TARGET'; id: string; delta: number }
  | { type: 'REMOVE_DRILL'; id: string } | { type: 'RESET_DRILLS' }
  | { type: 'SET_DRILL_DRAFT'; patch: ... }
  | { type: 'SHOW_TOAST'; msg: string } | { type: 'CLEAR_TOAST' };
```

### 6.3 부수효과(잔디+1 + 토스트) 처리 패턴
- reducer는 순수 유지. **잔디+1·토스트 같은 연쇄는 reducer 안에서 상태 동시 갱신**(예: `SET_DRILL_COUNT`에서 before<target && after>=target이면 grass도 함께 +1, 그리고 `pendingToast` 필드 set). 토스트 자동 소거(1.9s)는 `useApp` 훅의 `useEffect`로.
- **persist**: `AppContext` Provider에서 `useEffect([grass,journal,drills,collected,lang])` → `save()` 호출(디바운스 불필요). 또는 dispatch 래퍼에서 영속 키 변경 시 save. **단순화: Provider useEffect 채택.**

### 6.4 localStorage (`state/persist.ts`)
- 키: `cs_grass`, `cs_journal`, `cs_collected`, `cs_drills`, `cs_lang`. (후속: `cs_sheets`, `cs_lessons`.)
- `load()`: 각 키 JSON.parse(try/catch). 없으면 seed. collected 없으면 `['C|maj','G|maj','A|min','F|maj']` buildChord 시드.
- `save(partial)`: 존재하는 키만 set. try/catch(quota·private mode 대비).
- 초기화 순서: Provider 초기 state는 `load()` 결과로 lazy init(`useReducer(reducer, undefined, () => initState())`).

[QA 경계면 7]: persist round-trip. 새로고침 후 grass/journal/drills/collected 동일. JSON 직렬화에 `Date` 없음(GrassMap·entry는 문자열 날짜만) 확인 — buildGrass의 `date:Date`는 파생값(저장 안 함) OK.

---

## 7. 디자인 토큰 매핑 & CSS Modules 변환 전략

### 7.1 `src/styles/tokens.css` (`:root`)
```css
:root{
  /* 색 (원본 colors() + DESIGN-figma.md) */
  --c-ink:#000; --c-muted:#5b5b57; --c-faint:#9a9893;
  --c-border:#e6e6e6; --c-line:#f1f1f1; --c-panel:#f7f7f5; --c-canvas:#fff;
  --c-accent:#0052cc; --c-soft:rgba(0,82,204,.078);   /* accent + 14(hex)=≈8% */
  --c-home-streak:#e8f2d2;        /* 홈 focus 스트릭 카드 */
  /* 잔디 */
  --g0:#ebedf0; --g1:#9be9a8; --g2:#40c463; --g3:#30a14e; --g4:#216e39;
  /* 폰트 */
  --f-sans:Inter,"D2Coding","SF Pro Display",system-ui,helvetica,"Apple Color Emoji","Segoe UI Emoji",sans-serif;
  --f-mono:"JetBrains Mono","D2Coding",ui-monospace,monospace;
  /* 라운딩 */
  --r-xs:2px; --r-sm:6px; --r-md:8px; --r-card:16px; --r-lg:24px; --r-pill:50px; --r-full:9999px;
  /* 간격 */
  --s-xxs:4px; --s-xs:8px; --s-sm:12px; --s-md:16px; --s-lg:24px; --s-xl:28px; --s-xxl:48px;
}
```
> **soft 알파 주의**: 원본 `a+'14'` 는 8자리 hex(`#0052cc14` = 알파 0x14=20/255≈8%). CSS 변수는 `rgba(0,82,204,0.078)` 또는 `#0052cc14`(브라우저 지원 OK) 사용.

### 7.2 변환 전략 (인라인 → CSS Modules)
- 원본은 `React.createElement` + 인라인 객체 스타일. **시각 결과만 재현** → 각 컴포넌트 `.module.css`로 옮김. 동적 값(active/선택, width prop, accent 채움 여부)은 ① CSS 변수 오버라이드(`style={{'--w': width}}`) 또는 ② 조건부 className.
- **SVG 내부 좌표·색은 인라인 유지 허용**(기하 계산값이므로). 단 색은 CSS 변수 참조(`stroke="var(--c-ink)"` 형태로 SVG attr 대신 style/className 권장; 불가 시 상수 import).
- 폰트/이모지: 이모지는 `.ae` 클래스(global.css)로 Apple/Segoe 이모지 폰트 지정.

### 7.3 `global.css` 반응형 (원본 @media 그대로)
- `≤820px`: `.app-shell` column, `.app-sidebar` 가로(라벨 span 숨김), `.sb-foot` 숨김, `.sb-nav` row.
- `≤600px`: `.app-head` 패딩 축소·wrap, view 패딩 좌우 16.
- `≤440px`: `.streak-chip` 숨김, 브랜드 텍스트 숨김.
- scrollbar 스타일, `@keyframes toastIn`.
- **클래스명 유지**: `.app-shell/.app-sidebar/.sb-nav/.sb-brand/.sb-foot/.app-head/.head-actions/.streak-chip` — 반응형 셀렉터가 이 이름에 의존하므로 셸 컴포넌트에 동일 className 부여(또는 module + :global 혼용). **권장: 셸 레이아웃 반응형은 global.css에 두고 컴포넌트에 해당 className 직접 부여.**

---

## 8. 단계별 구현 계획 (빌드 순서, TDD 친화)

각 단계 = "한 호흡에 구현+검증". 단계마다 검증 경계면(producer→consumer) 명시.

### 단계 ① 스캐폴딩
- Vite react-ts 생성, vitest/RTL/jsdom 설치, `vite.config.ts`(test 설정), `vitest.setup.ts`, tsconfig strict.
- `tokens.css`/`global.css` 작성, `index.html` 폰트 링크, 빈 `App.tsx`("코드살롱" 렌더).
- **검증**: `npm run dev` 부팅, `npm run build` OK, 더미 테스트 1개 `npm test` OK.

### 단계 ② 도메인 엔진 + 단위 테스트 (최우선·최대 비중)
- `constants.ts` 이식(상수 무결성: INTERVALS/SUF가 모든 Quality 커버 — 타입 강제).
- `notes/chord/voicing/diatonic/scale/diagram/practice.ts` 순수 함수 이식.
- **테스트 작성 우선**(TDD): 아래 골든 케이스.
  - `chord.test`: `buildChord(0,'maj')`=C → `['x',3,2,0,1,0]`(OPEN). `buildChord(5,'maj')`=F → barre E-shape `[1,3,3,2,1,1]`. `buildChord(2,'m7b5')` 특수식. name 생성(SUF).
  - `voicing.test`: `requiredPCs` drop 순서(예: maj9처럼 음 5개+ → 4개로, 7=완전5도 제거 우선). `bestVoicing` 결과 length 6·필수음 포함·운지폭≤4·연속(중간 'x' 없음). `allVoicings` 정렬·중복 pos 없음·≤10.
  - `diatonic.test`: C major → [Cmaj7(Imaj7), Dm7(ii m7), …, Bm7b5(viiø)]. A minor roman 매핑.
  - `scale.test`: `scaleNotes(0,'major')`=[0,2,4,5,7,9,11]. blues 등.
  - `diagram.test`: 1프렛 코드 showNut=true. 7프렛 코드 start=mn·showNut=false. dots row 계산. mute/open marker.
  - `practice.test`: stats(streak 오늘 미기록 시 어제부터, week 7일 합). level 경계(0/2/4/6). buildGrass 주 개수·null 패딩.
- **검증 경계면**: 도메인 출력 shape가 §3 타입과 일치. **이 단계 그린 후에만 UI 진행.**

### 단계 ③ 다이어그램 렌더 (`ChordDiagram`)
- `computeDiagram` 소비 → SVG. variant dots/tones. width prop.
- **테스트**: RTL로 `<ChordDiagram frets={Cmaj}/>` 렌더 → svg 존재, dot circle 개수=운지수, showNut 시 굵은 선, mute × 텍스트. tones variant 음이름 텍스트.
- **경계면 1**: `buildChord().frets` → `ChordDiagram`.

### 단계 ④ 코드 사전 (`DictionaryView` + `ChordCard` + `ChordDetailModal` + `Segmented` + `RootPills`)
- dictMode/keyType/root/query 상태 연결(임시 로컬 or context).
- 키별: `diatonic` 그리드. 루트별: QGROUPS 그리드. 검색: normalizeQuery 매칭.
- 카드 클릭/모든폼 → 모달(`allVoicings` + 구성음 태그). 담기 → collected.
- **테스트**: 키별 7카드 렌더, 루트 변경 시 갱신. 검색 'am7' → 결과 포함. 모달 폼 개수=allVoicings length. 담기 시 collected 증가·중복 토스트.
- **경계면 2,5(담기)**: diatonic/allVoicings/검색 → 뷰.

### 단계 ⑤ 스케일 (`ScalesView` + `Fretboard`)
- scaleTabs/root → `scaleNotes` → Fretboard. 구성음 칩·범례.
- **테스트**: 지판 원 개수(스케일 음이 지판에 나타나는 수), 루트 강조 클래스. 칩 'R' 라벨.
- **경계면 3**: scaleNotes → Fretboard.

### 단계 ⑥ 연습 기록 (`PracticeView` + StatCard/DrillList/GrassHeatmap/JournalForm/JournalCard) + 상태/persist 본격화
- 이 단계에서 `appReducer`/`AppContext`/`persist`/`seed` 완성(앞 단계 임시 상태를 context로 승격).
- stats 카드, 드릴(스탬프/목표±/추가삭제/비우기/달성 잔디+1), 잔디(buildGrass) + 오늘기록, 일지 폼·카드.
- **테스트**: 드릴 스탬프 클릭 → count 증가; 마지막 칸 재클릭 → 감소. 목표 달성 시 grass[today] 증가. 일지 제출 → journal prepend + grass+1 + draft 리셋. persist: dispatch 후 localStorage에 cs_* 기록(RTL + jsdom localStorage). 새로고침(재마운트) 후 복원.
- **경계면 4,5,6,7**: buildGrass/drill/journal/persist.

### 단계 ⑦ 홈 (`HomeView`)
- focus(스트릭 라임 카드 + 잔디 + 추천코드) / board / minimal. homeLayout 세그.
- 추천코드 `['C|maj','G|maj','A|min','F|maj','D|min','E|min']` buildChord. board의 collected/최근일지.
- **테스트**: layout 전환 시 렌더 변화. focus 스트릭 = stats.streak. 추천 6코드 다이어그램.
- **경계면**: stats/grass/collected → 홈.

### 단계 ⑧ 셸 / 네비 / 반응형 마감 (`Sidebar`/`Header`/`Toast`/`App` 라우팅)
- 사이드바 6항목(builder/lesson disabled), 활성 스타일, 푸터 weekCount. 헤더 eyebrow/title/streak칩/로그버튼. 토스트.
- 반응형 @media 적용·확인(820/600/440 브레이크포인트).
- **테스트**: 네비 클릭 시 view 전환(활성 4뷰), disabled 클릭 무동작. 헤더 로그버튼 → grass+1. (반응형은 수동/뷰포트 테스트.)
- **검증**: 전체 `npm run build` + `npm test` 그린. AC 전수 점검.

---

## 9. 후속 확장 포인트 (자리 예약)

- **악보 만들기(Builder)**: AppState에 `sequence/sheets/armedChord/timeSig/sheetTitle` 타입 슬롯 유지. navDefs builder 항목 `disabled→enabled` 전환만. `views/BuilderView.tsx` 추가(원본 605-672 이식). collected 팔레트는 이미 동작(담기). 액션: `appendSeq/placeAt/saveSheet/loadSheet` 액션 추가.
- **레슨(Lessons)**: `lessons` 슬롯 + `views/LessonView.tsx`(원본 715-752). homework→drills 연동(`homeworkToDrills`)은 DrillList의 onAdd 재사용. persist `cs_lessons`.
- **오디오**: `domain/audio.ts`(ensureAudio/pluck/playChordAt/strumSeq, 원본 435-447). ChordCard/모달/다이어토닉 "전체 듣기"의 disabled 재생 버튼을 활성화. Web Audio는 SSR/test 환경 가드.
- **복사**: `domain/canvas.ts`(renderCanvas/copyChord, 원본 415-432). 복사 버튼 활성화. clipboard 폴백(다운로드).
- **i18n(EN)**: `i18n/strings.ts`에 `L(ko,en)` 패턴. MVP는 `lang='ko'` 고정, 모든 UI 문자열을 `t('key')` 또는 `L(...)` 경유. `state.lang`/`cs_lang`·`setLang`·`autoLang`은 타입/슬롯 유지, EN 토글 활성화만 후속. **구현 시 하드코딩 금지 — 문자열은 strings.ts 경유**(후속 비용 최소화).
- **재생/복사 버튼 슬롯**: ChordCard/모달에 이미 disabled 버튼 자리 → prop(onPlay/onCopy) 추가 시 활성.

---

## 10. 리스크 / 모호성 / 트레이드오프

| # | 항목 | 리스크/결정 | 권고 |
|---|------|-------------|------|
| R1 | `requiredPCs`/`_collect` 스코어링 미세 이식 | 원본과 1비트라도 다르면 보이싱 결과 달라짐(음악 부정확) | 라인 314·322-333 **문자 그대로** 이식, 골든 테스트로 회귀 방지. 부동소수 `*0.3` 비교 그대로. |
| R2 | 보이싱 캐시 순수성 | 모듈 스코프 Map 캐시가 테스트 격리 깨뜨릴 수 있음 | 캐시는 입력→출력 결정론적이므로 무해. 테스트는 결과값만 단언. 필요시 `__clearCache()` 노출. |
| R3 | accent 기본색 모호 | DESIGN은 모노(#000) 정체성, 원본 props 기본 `#0052cc` | **#0052cc 채택**(원본 동작 일치). 잔디/루트강조/소프트배경에 사용. 변경 원하면 토큰 1곳만 수정. |
| R4 | KO/EN 토글 표시 여부 | MVP는 KO 단일 | 토글 버튼 **렌더하되 KO만 활성**(EN 클릭 무동작 or 비활성 스타일). 사이드바 비주얼 유지. |
| R5 | builder/lesson 네비 | 숨김 vs 비활성 | **비활성(disabled)** 채택 — 6항목 사이드바 비주얼·후속 슬롯 보존. |
| R6 | 재생/복사 버튼 | 오디오/canvas 후속 | 카드/모달에 **disabled 버튼 유지**(자리·시각 일치). 활성화는 후속 1줄. |
| R7 | FretArray 길이 보장 | 타입상 일반 배열 | buildChord/barre/bestVoicing 출력 length===6 단언 테스트 추가. |
| R8 | SVG 색을 CSS 변수로 | SVG attr `stroke`는 CSS var 가능하나 일부 환경 차이 | 색은 `style`/className 또는 상수 import. 기하 수치는 인라인 유지(가독성). |
| R9 | `jMin` 타입 number\|string | input value는 string, 저장 시 Number() | 드래프트는 string 허용, 커밋(addJournal) 시 `Number(jMin)||0`. |
| R10 | seed EN 분기 | 원본은 lang별 시드 | MVP KO 고정 → **KO 시드만** 구현(EN 분기 생략, 후속 추가). |
| R11 | persist 타이밍 | useEffect 영속화가 첫 마운트(load 직후)에 불필요 save 유발 | 첫 렌더 skip(ref 가드) 또는 무해하므로 허용. 권장: 단순 useEffect. |

---

## 11. 검증 경계면 요약 (qa-verifier 체크리스트)

| 경계면 | 생산자(producer) | 소비자(consumer) | 계약(shape/규칙) |
|--------|------------------|------------------|------------------|
| 1 코드→다이어그램 | `buildChord(ni,q).frets` | `ChordDiagram` / `computeDiagram` | `Fret[]` len 6; start/showNut/dots/markers 정확 |
| 2 다이어토닉/루트/검색→그리드 | `diatonic`,`buildChord`,검색필터 | `DictionaryView`/`ChordCard` | Chord[] (roman 포함), 검색 normalize |
| 3 스케일→지판 | `scaleNotes(root,type)` | `Fretboard` | PitchClass[]; 루트 강조 |
| 4 잔디→히트맵 | `buildGrass`,`level` | `GrassHeatmap` | GrassWeek[] ~53주, level 0-4 |
| 5 드릴 카운트→잔디 | `SET_DRILL_COUNT` reducer | grass / toast | before<target&&after>=target일 때만 +1 |
| 6 일지 제출→상태 | `ADD_JOURNAL` reducer | journal/grass/draft | prepend + grass+1 + draft reset |
| 7 영속화 | Provider persist | localStorage cs_* | round-trip 일관, JSON 직렬화 안전 |
| 8 모든 폼 | `allVoicings(root,q)` | `ChordDetailModal` | 정렬·≤10·OPEN/fr 라벨·구성음 태그 |
| 9 상수 무결성 | `constants.ts` | 전 도메인 | INTERVALS/SUF가 모든 Quality 커버(타입 강제) |
| 10 통계 | `stats(grass)` | StatCard/Header/Home | streak/days/week/total 규칙 |

---

## 12. implementer 착수 지점

- **첫 구현 단위 = 단계 ① + 단계 ②**(스캐폴딩 → 도메인 엔진 + 테스트). 도메인이 그린이 되기 전 UI 금지.
- 도메인 이식 시 원본 라인 참조: 상수 172-197 / buildChord·barre 294-311 / voicing 313-345 / diatonic·scale 383-390 / computeDiagram 393-401 / 기하상수 405-413·582-588 / stats·level·buildGrass 525-532 / 시드 232·239-281.
- 막히거나 모호하면 architect에 질의(설계 보완 후 본 문서 갱신).
