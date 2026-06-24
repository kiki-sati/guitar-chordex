# 구현 로그: 코드살롱 (guitar-chordex) MVP

> 작성: implementer · 2026-06-24 · 입력: `01_architect_plan.md` + `request.md` + 디자인 SoT(`기타 코드 연습 Figma.dc.html`)
> 방법: react-tdd-implementation 스킬 (Red→Green→Refactor). 도메인 수치/로직은 원본 HTML 라인 그대로 이식.

## 최종 결과 (실제 명령 출력 근거)

- `npm run build` (tsc -b + vite build): **통과** (BUILD_EXIT=0, 80 modules transformed, JS 188.77 kB / CSS 20.82 kB)
- `npx vitest run`: **108 tests passed (15 test files)**, 실패 0
- `npx tsc -b` (strict): **통과** (TSC_EXIT=0)

## 단계별 구현 내역

### 단계 ① 스캐폴딩
- `package.json`(react/react-dom 런타임, vitest/RTL/jsdom devDeps), `tsconfig.json`/`tsconfig.app.json`(strict, noUnusedLocals/Parameters)/`tsconfig.node.json`, `vite.config.ts`(test: jsdom+globals+setupFiles), `vitest.setup.ts`(@testing-library/jest-dom + localStorage.clear), `index.html`(Inter/JetBrains Mono preconnect), `src/main.tsx`, `src/vite-env.d.ts`(*.module.css 선언).
- `src/styles/tokens.css`(CSS 변수: 색/잔디 GLEVELS/폰트/라운딩/간격, accent=#0052cc, soft=rgba(0,82,204,.078)), `src/styles/global.css`(D2Coding @font-face, reset, scrollbar, @keyframes toastIn, 820/600/440 @media — 원본 그대로).
- **검증**: 스캐폴딩 빌드 OK, 더미 smoke 테스트 1개 통과.

### 단계 ② 도메인 엔진 + 단위테스트 (TDD, 최우선)
- `src/domain/types.ts`: 계획 §3 타입 그대로(Note/Quality 리터럴 유니온, Fret=number|'x', Chord/VoicingCandidate/DiagramGeometry/Stats/Drill/JournalEntry 등).
- `src/domain/constants.ts`: NOTE/SUF/OPEN/scaleDefs/scaleLabels(+En)/GLEVELS/QUALS/INTERVALS/BARRE_OK/QGROUPS/OPENPC/OPEN_MIDI — 원본 라인 172-197 그대로. INTERVALS·SUF를 `Record<Quality,...>`로 타이핑해 모든 Quality 커버를 컴파일 타임 강제(경계면 9).
- `src/domain/notes.ts`: noteName/dateStr/normalizeQuery.
- `src/domain/chord.ts`: buildChord(우선순위 ①OPEN→②m7b5 특수→③BARRE_OK→④bestVoicing), barre(E/A shape 선택), chordPCs, requiredPCs(drop 7→2→5, 최대 4음).
- `src/domain/voicing.ts`: enumBase/collect/bestVoicing/allVoicings + 모듈 스코프 메모 캐시 + `__clearVoicingCache()`. 스코어링(베이스≠루트 +4, +(6-cnt), 운지폭*0.3) 원본 라인 322-333 그대로.
- `src/domain/diatonic.ts`: diatonic(major/minor quals·romans, roman+key 부여).
- `src/domain/scale.ts`: scaleNotes.
- `src/domain/diagram.ts`: computeDiagram(start 산정 mx>5일 때만 mn, showNut, dots/markers).
- `src/domain/practice.ts`: stats(streak 오늘 미기록 시 continue, week 7일 합)/level/buildGrass(53주). 순수성 위해 `grass`/`today`를 인자로 파라미터화(원본 this.state 의존 제거).
- 테스트(54개): chord(12)/voicing(10, 음악적 타당성 불변식)/diatonic(6, C major·A minor 골든)/scale(5)/diagram(6)/practice(9)/notes(6).
- **도메인 그린 후에만 UI 진행.**

### 상태 계층 (단계 ⑥ 선행)
- `src/state/seed.ts`: seedGrass(결정론적 해시 (i*2654435761)%97 + 최근 7일 [2,2,1,3,1,2,1])/seedJournal/seedDrills/seedCollected — KO만(R10).
- `src/state/persist.ts`: load(없으면 시드)/save(존재 키만)/KEYS(cs_grass/journal/collected/drills/lang). try/catch 가드.
- `src/state/appReducer.ts`: AppState/Action/reducer/initState. 부수효과(드릴 목표 달성 시 grass+1+토스트, 일지 제출 시 prepend+grass+1+draft 리셋)를 reducer 안에서 상태 동시 갱신. exhaustive never 체크.
- `src/state/AppContext.tsx`: useReducer(lazy init=load()) + persist useEffect(첫 마운트 skip ref 가드) + 토스트 1.9s 자동 소거.
- 테스트(21개): appReducer(18, 경계면 5·6 전이 로직 포함)/persist(3, round-trip).

### 단계 ③ ChordDiagram (경계면 1)
- `src/components/ChordDiagram.tsx`: computeDiagram→SVG. variant dots/tones(§4.7 기하 표 그대로: VB104/VH136, ML 20|22, gap (VB-38|40)/5, r 6.4|7.6, 너트 굵기, tones는 음이름+행 프렛번호). data-testid로 dot/open/mute/nut/poslabel 노출.
- 테스트(7): svg/dot 개수/마커/너트/시작프렛 라벨/tones 음이름.

### 단계 ④ 코드 사전 (경계면 2,5,8)
- `src/components/Segmented`/`RootPills`/`ChordCard`(재생·복사 disabled 슬롯, 담기·모든폼 활성)/`ChordDetailModal`(allVoicings + INTERVALS 구성음 태그, 폼 라벨 OPEN|Nfr).
- `src/views/DictionaryView.tsx`: 키별(diatonic)/루트별(QGROUPS)/검색(normalizeQuery, 12루트×QUALS 매칭, 무결과 메시지).
- 테스트(6): 7 다이어토닉 카드/루트 변경/검색 am7/무결과/루트별 그룹/담기.

### 단계 ⑤ 스케일 (경계면 3)
- `src/components/Fretboard.tsx`(원본 기하 FR12/W640/H158/ML30/MT16/MB24, 루트 accent 강조, f0 너트 좌측, 프렛마커 [3,5,7,9,12]).
- `src/views/ScalesView.tsx`: 스케일 5탭/루트 12pill/구성음 칩(R,2,3…)/범례.
- 테스트(4): 지판 원·루트 강조/R 칩/탭 전환/범례.

### 단계 ⑥ 연습 기록 (경계면 4,5,6,7)
- `src/components/StatCard`/`GrassHeatmap`(buildGrass+범례)/`DrillList`(스탬프 클릭 i+1===count?i:i+1, 목표±, 추가/삭제/비우기)/`JournalForm`/`JournalCard`.
- `src/views/PracticeView.tsx`: 통계 4카드/드릴/잔디+오늘기록/일지 폼·카드.
- 테스트(6): 4 통계/잔디·일지 렌더/드릴 추가/LOG_PRACTICE persist/일지 제출 persist/스탬프 클릭 카운트.

### 단계 ⑦ 홈
- `src/views/HomeView.tsx`: focus(라임 #e8f2d2 스트릭 카드+잔디+추천 6코드)/board(잔디 span+연속+최근일지+담은코드)/minimal. 추천코드 ['C|maj','G|maj','A|min','F|maj','D|min','E|min'].
- 테스트(4): focus 스트릭·추천/6 다이어그램/board 담은코드/minimal.

### 단계 ⑧ 셸/네비/반응형
- `src/components/Sidebar.tsx`(6항목 navDefs, builder/lesson disabled+흐림+준비중 title, 활성 검정배경, 푸터 weekCount/streak)/`Header.tsx`(eyebrow/title/🔥 스트릭칩/로그버튼)/`Toast.tsx`.
- `src/App.tsx`: AppProvider+Sidebar+Header+view switch(home/dictionary/scales/practice; builder/lesson 폴백)+Modal+Toast. 반응형 className(app-shell/app-sidebar/sb-nav/sb-brand/sb-foot/app-head/head-actions/streak-chip + view-pad)을 global.css @media와 연결.
- 테스트(6): 브랜드/홈 시작/4뷰 네비/builder·lesson disabled/헤더 로그버튼 grass+1/모달 열고닫기.

## 계획 대비 결정/차이
- **도메인 순수화**: 원본 stats/buildGrass/seed는 `this.state`/`new Date()`에 의존 → `grass`, `today` 인자화하여 순수 함수로(테스트 결정성 확보). 결과값은 원본과 동일.
- **i18n**: 모든 UI 문자열을 `src/i18n/strings.ts`(ko 맵 + headerTitles + scaleLabelKo) 경유. 하드코딩 회피(계획 §9). lang 슬롯·cs_lang 유지, EN 토글은 후속.
- **타입 안전성**: `any`/무분별 `as` 미사용. seedCollected는 `as never` 대신 `ReadonlyArray<[Note,Quality]>`로 타입 보존. _collect 내 `'x'` 분기 후에만 `as number` 좁힘(원본 런타임 동작 보존, 타당한 내로잉).
- **재생/복사/builder·lesson**: 계획대로 disabled 슬롯/네비. onPlay/onCopy prop 자리만 주석으로 예약.
- **soft 알파**: `rgba(0,82,204,.078)`(원본 #0052cc14 ≈ 8%)로 토큰화.

## 후속 확장 슬롯 (유지됨)
- AppState/타입에 lang(EN), Drill.seq/sheetId/timeSig, CollectedChord 등 슬롯 유지.
- 카드/모달 disabled 재생·복사 버튼(onPlay/onCopy prop 추가 시 활성).
- Sidebar builder/lesson disabled→enabled 전환만으로 네비 활성화 가능.
- persist KEYS에 cs_sheets/cs_lessons 추가 여지(미생성).

## 미해결 / 주의 사항
- **반응형은 자동 테스트 미포함**(@media는 jsdom에서 검증 불가) — 820/600/440 브레이크포인트는 global.css에 원본 규칙 그대로 이식, 수동/뷰포트 검증 필요.
- **폰트(Inter/JetBrains Mono/D2Coding)는 CDN 로드** — 오프라인/CSP 환경에서 폴백(system-ui/monospace)로 표시.
- **이모지**(.ae 클래스)는 OS 이모지 폰트 의존.
- 보이싱 골든값은 음악적 불변식(필수음·운지폭≤4·연속·정렬·≤10폼)으로 검증 — 원본과 동일 알고리즘/캐시이므로 결정론적.

## 변경 파일 목록
설정: `package.json`, `tsconfig*.json`, `vite.config.ts`, `vitest.setup.ts`, `index.html`
스타일: `src/styles/{tokens,global}.css`
엔트리: `src/main.tsx`, `src/vite-env.d.ts`, `src/App.tsx`, `src/App.module.css`, `src/App.smoke.test.tsx`, `src/test-utils.tsx`
도메인: `src/domain/{types,constants,notes,chord,voicing,diatonic,scale,diagram,practice,index}.ts` + `src/domain/__tests__/{chord,voicing,diatonic,scale,diagram,practice,notes}.test.ts`
상태: `src/state/{seed,persist,appReducer}.ts`, `src/state/AppContext.tsx` + `src/state/__tests__/{appReducer,persist}.test.ts`
i18n: `src/i18n/strings.ts`
컴포넌트(+.module.css): `src/components/{Segmented,RootPills,ChordDiagram,ChordCard,ChordDetailModal,Fretboard,GrassHeatmap,StatCard,DrillList,JournalForm,JournalCard,Sidebar,Header,Toast}.tsx` + `src/components/__tests__/ChordDiagram.test.tsx`
뷰(+.module.css): `src/views/{HomeView,DictionaryView,ScalesView,PracticeView}.tsx` + `src/views/__tests__/{HomeView,DictionaryView,ScalesView,PracticeView}.test.tsx`
