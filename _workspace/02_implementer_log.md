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

---

# 구현 로그 추가: PR-A 코드 표기 별칭 + 검색 강화

> 작성: implementer · 2026-07-08 · 입력: `26_slash_tension_plan.md`(PR-A 범위) · 브랜치: `feat/chord-name-search`(origin/main 기준)
> 방법: react-tdd-implementation(Red→Green→Refactor). **도메인 quality 무변경** — 매핑 계층만 신설. `Chord`/voicing/INTERVALS/SUF 무변경.

## 범위 (계획서 PR-A만)
- 별칭 테이블 + 케이스 민감 파서 + 검색 도메인화 + DictionaryView 얇은 배선.
- PR-B(슬래시)/PR-C(신규 quality)는 **미포함**. 슬래시 입력은 파서/검색 모두 미지원 처리(파서 null, 검색 빈 결과).

## 신규/변경 파일
- `src/domain/aliases.ts` (신규): `QUALITY_ALIASES` — `M7/Δ/ma7/major7→maj7`, `add2↔add9`, `7(9)→9`, `7(b9)→7b9`, `7(#9)→7#9`, `7(11)→11`, `7(13)→13`, `m7(9)→m9`, `m7(11)→m11`, `m7(b5)→m7b5`, `maj7(9)→maj9`, `maj7(11)→maj11`, `maj7(#11)→maj#11`, `maj/major→maj`, `min/minor→min`. **소문자 `m7`은 절대 미포함**(케이스 함정).
- `src/domain/normalize.ts` (신규): `normalizeChordText` — `Δ→maj7`·`♭↔b`·`♯↔#`·toLowerCase. `notes.ts`의 `normalizeQuery`는 **무변경**.
- `src/domain/parseChordName.ts` (신규): 케이스 민감 파서. `ParsedChord{root,qualKey,bass?,display}|null`. 대문자 M(뒤 `aj` 아님)=maj7류(단독 M=maj triad), 소문자 m(뒤 `aj` 아님)=minor류(단독 m=min triad). 슬래시(`/`) 입력=null(PR-B).
- `src/domain/searchChords.ts` (신규): `searchChords(query):ChordSearchHit[]`. 12루트×58질×(이명동음 루트 표기 Db/Eb/Gb/Ab/Bb + 별칭 접미사) 전개 인덱스 부분일치. 레거시 알고리즘의 **상위집합**(회귀 0 — 골든으로 증명). 슬래시 쿼리=빈 결과.
- `src/domain/index.ts` (변경): normalize/aliases/parseChordName/searchChords barrel export 추가.
- `src/views/DictionaryView.tsx` (변경, 얇게): 인라인 이중 루프 → `searchChords(query).map(buildChord)`. UI 구조·카드 렌더 무변경. `normalizeQuery/QUALS/SUF` import 정리.

## 테스트 (신규 골든)
- `src/domain/__tests__/aliases.test.ts` (20): 별칭 골든 + 모든 타깃이 실제 quality(INTERVALS 존재) + `m7`↛maj7 케이스 가드.
- `src/domain/__tests__/parseChordName.test.ts` (49): 루트 17종(샤프/플랫/유니코드/소문자), 케이스 민감 표(AM7/Am7/am7/AMaj7/Amaj7/AM/Am), 인벤토리 비슬래시 15종, Δ/유니코드 플랫, 실패(빈/슬래시/미지 quality/H·X).
- `src/domain/__tests__/searchChords.test.ts` (33): 레거시 회귀(빈 쿼리·C·Bb 이명동음), 인벤토리 15종 히트, 케이스 함정(AM7·Am7 둘 다 히트), Δ/유니코드, 레거시 상위집합 9쿼리, 슬래시 빈 결과.

## 골든 커버리지 (인벤토리 비슬래시 §1.1)
- 파서·검색 각각 **15/15 히트**: AM7·CM7·GM7·Aadd2·Cadd2·Dbadd2·Gadd2·Am6·D7(9)·Eb7(9)·C#7(b9)·F#m7(11)·E7sus4·Bbm7·G#m7.
- 역케이스 단언: `Am7`→m7, `AM7`→maj7 (파서 정확매칭). 검색은 관대(둘 다 히트) — 계획 §5.1 준수.

## 확정 기본값 반영
- add2 = 별칭 흡수(카드 canonical `Cadd9`, 검색만 add2). 단독 대문자 M = major triad. 이명동음 검색 양쪽 수용, 표시는 canonical.

## 검증 결과
- `npx tsc -b`: **0** (strict). `npm test`(vitest run): **455 passed / 48 files, 0 fail**(신규 102 포함). `npm run build`: (하단 최종 라인 참조).
## 수정: SyncRepo.dispose() in-flight 쓰기 취소 (2026-07-08, 교차 이음새 QA / AC⑤-9)

> 방법: react-tdd-implementation (Red→Green). 입력: 오케스트레이터 확정 설계 + 2026-07-03 교차 이음새 QA(BLOCKING).

### 버그
`dispose()`가 online 리스너만 해제하고 `start()`가 띄운 in-flight 비동기 작업(`initialSync`·`flushQueue`)과 in-flight `apply`를 취소하지 못했다. 로그아웃 시 `clearUserCache(uid)`가 캐시(`u:{uid}:cs_*`)·큐(`u:{uid}:cs_queue`)를 물리 삭제한 뒤에도, 늦게 resolve된 `initialSync`가 `local.saveAll(merged)`로 캐시를, 늦게 resolve된 `flushQueue`가 `queue.remove()`(내부 `write`)로 큐 키를 부활시켜 **AC⑤-9(공유기기 프라이버시) 위반**.

### 설계 결정
- 부활을 실제로 일으키는 `saveAll`/`queue.remove`는 **syncEngine 함수 내부**에서 실행되므로 SyncRepo의 `.then` 가드만으로는 못 막는다 → **취소 시그널을 syncEngine까지 전달**.
- `SyncEngineDeps.isCancelled?: () => boolean` 선택 필드 추가(하위호환·React 무의존 유지). 미지정 시 기존 동작 불변.
  - `initialSync`: `mergePersisted` 후 `local.saveAll(merged)` **직전** 가드(취소 시 merged만 반환, 통지 없음).
  - `flushQueue`: for 루프 각 반복 시작 가드(취소 후 stale 토큰 push 중단) + `queue.remove(succeeded)` **직전** 가드.
- `SyncRepo`: `private disposed = false;` 추가. `dispose()`에서 `disposed=true`(기존 unsub 해제·멱등 유지). 세 engine 호출부에 `isCancelled: () => this.disposed` 전달. `.then(onMerged)` → `.then((merged) => { if (!this.disposed) onMerged(merged); })`. `apply()` 진입부 `if (this.disposed) return;`. `enqueue()` 진입부 `if (this.disposed) return;`(in-flight apply 실패 폴백 enqueue의 큐 부활 차단).
- 도메인 불변값(Quality/Fret/보이싱)·public API 시그니처 불변(옵셔널 추가만).

### 테스트 (src/state/__tests__/sync-repository.test.ts — 새 describe 4건)
`deferred<T>()`/`settle()`/`expectUserCacheCleared()` 헬퍼 추가(기존 base/makeRemote/setOnline/UID/GRASS_CHANGE 재사용).
1. `late initialSync must not resurrect user cache after logout clear` — loadAll deferred → dispose → clearUserCache → resolve → `userCacheKeys(UID)` 전부 부재 + onMerged 미호출.
2. `late flushQueue must not resurrect the queue key after logout clear` — 오프라인 apply 큐 1건 → 온라인 → saveGrass deferred → start(flush) → dispose → clearUserCache → resolve → 큐 키 부재.
3. `in-flight apply push failure must not re-enqueue after logout clear` — saveGrass deferred reject → apply in-flight → dispose → clearUserCache → reject → 큐 키 부재.
4. `apply after dispose is a no-op (no cache write, no remote call)` — dispose 후 apply → 캐시 부재 + remote 미호출.
- Red: 4건 전부 실패 확인 → Green: 4건 통과. 기존 B5-S1~S6 회귀 0. syncEngine 테스트(11건) 회귀 0.

### 검증 (실제 명령 출력)
- `npx tsc -b`: **통과** (TSC_EXIT=0)
- `npx vitest run`: **357 tests passed (45 files)**, 실패 0 (기존 353 + 신규 4)
- `npm run build`: **통과** (BUILD_EXIT=0, 183 modules transformed)

### 변경 파일
- `src/sync/syncEngine.ts` — `SyncEngineDeps.isCancelled?` 추가 + initialSync·flushQueue 가드.
- `src/state/sync-repository.ts` — `disposed` 필드 + dispose/apply/enqueue/start 가드 + JSDoc 갱신.
- `src/state/__tests__/sync-repository.test.ts` — 새 describe 4건 + 헬퍼/import(`clearUserCache`/`userCacheKeys`/`queueKey`).

## 보이싱 다형 노출 — 도메인 단계 (PR 1/2, `feat/voicing-forms`, 2026-07-08)

> 입력: `_workspace/27_voicing_forms_plan.md` §도메인(Step 1~4)만. UI(Step 5~6)는 별도 PR.
> 오케스트레이터 확정 파라미터: **N=3/pos, M=16 총, pos≥5 개방혼합 배제**, 정렬 template>루트베이스>풀보이싱>개방혼합>frets 사전순.
> 방법: TDD(Red→Green). 골든 기대값은 트레이스 스크립트로 파이프라인 실행 후 확정(손 추정 금지).

### Step 1 — 타입 + CAGED 템플릿 (`feat(voicing): CAGED movable shape templates + transpose` 취지)
- `src/domain/types.ts`(additive): `VoicingShapeName`/`VoicingForm{frets,source,shape?}`/`VoicingPosition{pos,forms}` 추가. 기존 `VoicingCandidate` 유지.
- `src/domain/voicing-shapes.ts`(신규): `MovableShape` 타입 + `CAGED_SHAPES`(maj/min/7/maj7/m7/sus4 각 E/A/D쉐입 + m7b5 A쉐입) + `ROOT_STRING_SHAPE=['E','A','D']` + `transposeShape(shape,root)`(barre + barre+12 두 옥타브). 오프셋은 chord.ts E_SHAPES/A_SHAPES와 동일 수치(대조 완료), D쉐입만 신규.
- 골든(`voicing-shapes.test.ts`, 10건): Cmaj7 A쉐입→`[x,3,5,4,5,3]`, Cmaj7 E쉐입→`[8,10,9,9,8,8]`, F maj E쉐입→`[1,3,3,2,1,1]`, B m7 A쉐입→`[x,2,4,2,3,2]`, G7 E쉐입→`[3,5,3,4,3,3]`, B♭ maj A쉐입→`[x,1,3,3,3,1]`, E♭ min D쉐입→`[x,x,1,3,4,2]`, +12 옥타브·뮤트 보존·오프셋 대조.

### Step 2 — voicingsByPosition 코어 (`feat(voicing): position-grouped multi-form voicings` 취지)
- `src/domain/voicing.ts`: `voicingsByPosition(root,qual): VoicingPosition[]` 신설. 파이프라인 = 템플릿 트랜스포즈(+MAX_TEMPLATE_FRET=14 컷오프) → collect 필터 → enum 병합 → 완전중복 dedup(template 우선) → pos≥5 개방혼합 큐레이션 → 포지션 그룹핑 → 포지션 내 5키 정렬 + 유사폼 dedup(동일 pcs + 요소차합≤1) + slice N → 전체 slice M. 상수 `MAX_FORMS_PER_POS=3`/`MAX_TOTAL_FORMS=16` export, `OPEN_MIX_CUTOFF_POS=5`/`MAX_TEMPLATE_FRET=14` 모듈 내부.
- 신규 `posCache` + `__clearVoicingCache()` 확장(bestCache/allCache/posCache).
- 골든(`voicing-forms.test.ts`, 15건): 표준 폼 포함(x35453 필수·CAGED 대표 6케이스·A3 12루트×5quality template≥1)·다형(B1)·상한 N≤3/M≤16(B2)·중복0(B3)·pos 유일·음악타당성 전수(C1)·비실전 배제(C2 `0,14,14,...` 부재·pos≥5 개방0 부재)·결정론(D1 캐시클리어 deep equal·D2 pos3 tie-break 순서 고정).

### Step 3 — allVoicings 어댑터화 (`refactor(voicing): allVoicings as flat adapter over positions` 취지)
- `allVoicings`를 `voicingsByPosition(...).flatMap(p=>p.forms.map(f=>f.frets))` 어댑터로 전환(@deprecated). allCache 유지.
- `voicing.test.ts` 갱신(§8.1): "≤10"→`MAX_TOTAL_FORMS`(16), "no duplicate positions"(옛 계약, 다형으로 의미 변경) → **삭제/재작성**: pos 유일성은 voicingsByPosition 그룹 키 수준에서만 보장. 어댑터 계약(골든 9) `allVoicings === flatMap(voicingsByPosition)` 추가. sort-ascending·req-pcs 계약 유지.

### Step 4 — 도메인 회귀 스위프 (E1/골든10)
- **E1 검증(바이트 불변)**: `bestVoicing`/`enumBase`/`collect` 함수 본문을 origin/main과 diff → **전부 IDENTICAL**. `buildChord`(chord.ts) 무변경 → 카드 대표 폼 무영향.
- **골든10/모달 회귀**: `omitted-tones.test.ts`(4건)·`ChordDetailModal.test.tsx`(2건) 그린. C9의 G 생략 배지: 새 `allVoicings(0,'9')` 폼 중 다수가 G(pc7) 생략 → 배지 케이스 유지(실측 확인).

### 검증 (실제 명령 출력 — 최종 커밋 상태)
- `npx tsc -b`: **통과** (TSC_EXIT=0)
- `npm test`(vitest run): **570 tests passed (59 files)**, 실패 0
- `npm run build`: **통과** (BUILD_EXIT=0, 204 modules transformed)

### 변경 파일 (도메인 PR)
- `src/domain/types.ts` — VoicingShapeName/VoicingForm/VoicingPosition 추가(additive).
- `src/domain/voicing-shapes.ts` — 신규(CAGED_SHAPES + transposeShape + ROOT_STRING_SHAPE).
- `src/domain/voicing.ts` — voicingsByPosition 신설 · allVoicings 어댑터화(deprecated) · posCache · MAX_* 상수. bestVoicing/enumBase/collect 무변경.
- `src/domain/__tests__/voicing-shapes.test.ts` — 신규(10건).
- `src/domain/__tests__/voicing-forms.test.ts` — 신규(15건).
- `src/domain/__tests__/voicing.test.ts` — §8.1 계약 갱신(dup-pos 재작성·상한 16·어댑터 계약).
