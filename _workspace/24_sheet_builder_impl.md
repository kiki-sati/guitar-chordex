# 구현 로그 — 악보 빌더 PR-1 (feat/sheet-builder-local)

> 구현: implementer · 정본: `_workspace/23_scorebuilder_plan.md` (PR-1 범위) · 디자인 SoT: `기타 코드 연습 Figma.dc.html` builderView(604-672)
> 방식: TDD (react-tdd-implementation). 순수 도메인 → 영속 → reducer → UI → 배선 순.
> 범위: **PR-1 로컬 전용만.** PR-2(동기화/DB/드릴연동) 미포함.

## 검증 결과 (최종)

| 게이트 | 명령 | 결과 |
|--------|------|------|
| 타입 | `npx tsc -b` | **exit 0** |
| 테스트 | `npm test` (vitest run) | **426 passed / 50 files** (기존 353 + 신규 73, 회귀 0) |
| 빌드 | `npm run build` (tsc -b → vite build) | **exit 0** (`built in 12.99s`) |

신규 테스트 73개 내역: sheet.test 23 · sheet-persist.test 6 · appReducer.builder.test 24 · BuilderView.test 11 · builder-components.test 9. (App.smoke.test는 기존 테스트를 빌더 활성에 맞게 in-place 수정 — 순증 0.)

## 파일 맵

### 신규 (도메인 · 순수)
- `src/domain/sheet.ts` — beatsOf/padSlots/placeAt/clearSlot/addMeasure/removeMeasure/retime/sequenceToMeasures/usedChords/filledCount/emptySequence/makeSheet. 원본 헬퍼(457-468, 607-608, 624) **수치 그대로 이식 + 불변화**(입력 mutate 금지, 새 배열 반환).
- `src/domain/__tests__/sheet.test.ts` — 골든 23케이스.

### 신규 (영속 · 로컬 전용)
- `src/state/sheet-persist.ts` — `SHEETS_KEY='cs_sheets'` + `loadSheets()`/`saveSheets()`. **동기화 계층과 완전 분리**(§6.3 방식 채택, 아래 §결정 참조).
- `src/state/__tests__/sheet-persist.test.ts` — round-trip, sparse null 보존, 손상 JSON 관용, 빈=빈배열.

### 신규 (UI)
- `src/views/BuilderView.tsx` (+ `.module.css`) — 상태·dispatch 배선 컨테이너.
- `src/components/builder/SheetCard.tsx` (+css) — 제목·박자표(Segmented)·[▶재생 disabled][비우기][저장]·hint·큰제목/N CHORDS·UsedChordBox·MeasureGrid·[+마디].
- `src/components/builder/UsedChordBox.tsx` (+css) — usedChords → ChordDiagram(72). 빈 시퀀스면 null.
- `src/components/builder/MeasureGrid.tsx` (+css) — sequenceToMeasures 분할 → BeatCell 격자. 마디>1일 때만 삭제 버튼.
- `src/components/builder/BeatCell.tsx` (+css) — 한 박 셀(place/clear/toast는 reducer PLACE_AT 위임). 채워짐=코드명 / 빈칸=armed면 '+' else '·'.
- `src/components/builder/ChordPalette.tsx` (+css) — collected arm 토글 카드 + ×제거, 빈 팔레트=사전 링크.
- `src/components/builder/SavedSheets.tsx` (+css) — 저장 목록 + 불러오기/삭제. 빈 목록이면 null.
- `src/components/builder/__tests__/builder-components.test.tsx` — 컴포넌트 단위 9케이스(경계 B1/B3/B4/B5).
- `src/views/__tests__/BuilderView.test.tsx` — 통합 11케이스(arm/place/save/load/delete/timeSig/add-measure/빈팔레트/재생disabled).

### 수정
- `src/domain/types.ts` — `TimeSig`/`SheetSlot`/`SheetSequence`/`Sheet` 추가(기존 불변 유지). `SheetSlot={name,frets}`은 `DrillSeqItem`과 **동일 shape**(R4 고정 — PR-2 드릴연동 정합).
- `src/domain/constants.ts` — `BEATS: Record<TimeSig,number>` 추가.
- `src/state/appReducer.ts` — AppState에 `sheets`(영속)/`sequence`/`armedChord`/`timeSig`/`sheetTitle`(트랜션트) + 11 액션. 계산은 domain 위임(reducer 순수). `initState(persisted, sheets=[])` 2번째 인자. HYDRATE는 spread로 보존(무변경).
- `src/state/AppContext.tsx` — init 시 `loadSheets()` 주입 + `state.sheets` 전용 effect `saveSheets` (sync effect deps 무변경, `persistedOf`에 sheets 미포함).
- `src/i18n/strings.ts` — 빌더 ko 문자열(EN 제외).
- `src/App.tsx` — `case 'builder' → <BuilderView>`.
- `src/components/Sidebar.tsx` — navBuilder `disabled:false`.
- `src/views/HomeView.tsx` — board `homeToBuilder` 활성(dispatch SET_VIEW builder).
- `src/App.smoke.test.tsx` — 빌더 활성 반영(navigate 5뷰, lesson만 disabled). R6 대응.

## 핵심 결정 · 계획 대비 편차

### 결정 1 — 영속화 방식: **PersistedState 확장 대신 격리형(cs_sheets 직접 키)** 채택
계획 §3.4는 `PersistedState`에 `sheets` 슬라이스 추가를 제시했으나, **작업 지시의 강한 경고 + 선호안**(“계획에 명시 없으면 동기화 코드가 절대 안 건드려지는 방식 = 빌더 전용 persist 유틸 + cs_sheets 직접 키를 택하라”)에 따라 **격리형**을 채택했다.

근거(검증됨): `PersistedState`는 동기화 엔진의 공유 계약이다 — `diff-changes.ts`/`sync-repository.ts`/`apply-changes.ts`가 이 타입을 직접 import하고, `SyncRepo.loadCached()/apply()`가 이 shape를 라운드트립한다. `sheets`를 여기에 추가하면 (a) 이 파일들·픽스처가 파급되고(R1) (b) 계획 §6.3이 금지한 “sheets가 서버로 새는 것” 방지를 위해 추가 방어가 필요하다. 격리형은 이 리스크를 **구조적으로 제거**한다:
- `sheet-persist.ts`가 `cs_sheets`에 직접 read/write. `PersistedState`/`Repository`/`LocalRepository`/`persist.ts` **일절 미변경**.
- reducer는 `sheets`를 상태로 들되, AppContext의 **별도 effect**(deps=`[state.sheets]`)가 `saveSheets`. sync persist effect의 deps(`grass/journal/drills/collected/lang`)와 `persistedOf`는 무변경 → diff/apply/push 경로에 sheets가 **애초에 진입 불가**.
- HYDRATE(서버 pull 머지)는 4슬라이스+lang만 교체하고 `...state` spread로 `sheets`·트랜션트를 보존 → 서버 값이 로컬 악보를 덮지 않음(테스트로 고정).

키 선택: PR-1은 “로그인 유저도 로컬만”(§Q5 수용)이므로 **비prefix `cs_sheets`**(기기-로컬, 계정 무관) 사용. 계획 §6.3/Q5가 명시한 한계와 일치. PR-2에서 서버 동기화 도입 시 per-user 반영.

> **동기화 diff/merge 영향 확인 결과: 없음.** `git diff --name-only main...HEAD`에 `repo-change/diff-changes/apply-changes/sync-repository/supabase-repository/mappers.ts`·`src/sync/**`·`supabase/**` **0건**(가드 통과). `persist.ts`·`repository.ts`·`local-repository.ts`도 미변경.

### 결정 2 — 시드 악보 없음
사용자 확정대로 `seedExampleSheet` 미이식. 첫 진입 `sequence=emptySequence(4)`(빈 8칸), `sheets=[]`. (계획 §9 Q3 (b)안·AC-21 제외 확정.)

### 결정 3 — 오디오 재생 disabled
SheetCard ▶재생 버튼 `disabled` + `title="준비 중"`(기존 '듣기' 패턴 재사용, `ko.comingSoon`). `strumSeq` 미이식. (§9 Q1.)

### 결정 4 — lyrics 완전 제외 / 배치 소스 collected만
원본 state의 `lyrics` 미도입. 팔레트는 collected만 노출(§9 Q4·Q7 확정).

### 편차(사소) — armed hint 문구 분리
원본은 `armChord` 후 hint에 `<b>name</b> 선택됨 —…`를 인라인 조합. i18n 하드코딩 회피를 위해 `builderArmedHintSuffix`(접미부)로 분리하고 name은 `<b>`로 렌더. 시각 결과 동일.

## 경계면(계획 §7) 준수

- B1 팔레트→arm: onClick이 `SheetSlot{name,frets}` 전달 → `ARM_CHORD`. (test)
- B2 armed→배치: reducer가 `placeAt(seq,i,armed)` 위임. (test)
- B3 시퀀스→격자: `sequenceToMeasures` 결과를 MeasureGrid/BeatCell가 소비, 각 마디 길이=beats. (test)
- B4 슬롯→다이어그램: `usedChords`/slot.frets → `<ChordDiagram frets width=72>` 재사용(신규 SVG 0). (test)
- B5 저장→영속: `SAVE_SHEET`→state.sheets→`saveSheets(cs_sheets)`. (test로 localStorage 확인)
- B6 악보→드릴(PR-2 대비): `SheetSlot`≡`DrillSeqItem`(`{name,frets}`) shape 동일 고정 — **타입 정합 유지**(R4).

## UI 계층 규칙(CLAUDE.md) 준수
- BeatCell/MeasureGrid/SheetCard: 코드/보이싱/기하 **직접 계산 없음** → domain(`sheet.ts`)·`ChordDiagram` 호출만.
- 배치/저장/삭제/arm: **전부 reducer action**(로컬 컴포넌트 시퀀스 state 미사용).
- 스타일: 인라인 프로토타입 미복사 → CSS Modules + `tokens.css` 변수만. 박자표는 기존 `<Segmented>` 재사용.

## 알려진 한계 / QA 유의점
- **브라우저 시각 검증 미완(환경 제약).** dev 서버가 로컬 `.env`의 Supabase 설정으로 **인증 게이트(로그인 화면)** 뒤에 앱을 두어, 비대화식 환경에서 OAuth를 완료할 수 없어 빌더 화면 스크린샷을 얻지 못함. 대신 11개 BuilderView 통합 테스트가 실제 컴포넌트 트리(SheetCard→Segmented/UsedChordBox/MeasureGrid/BeatCell + ChordPalette + SavedSheets + 실제 ChordDiagram SVG)를 렌더하고 arm/place/save/load/delete/timeSig/add-measure를 실제 reducer·cs_sheets 영속으로 관측한다. → **QA에서 인증 후 육안 회귀 확인 권장.**
- BeatCell 빈 셀의 접근성 이름은 텍스트(`·`/`+`)이므로 테스트는 `getAllByTitle`로 조회(문서화됨).
- 로그인 유저의 sheets는 PR-1에서 서버 미동기(로컬 `cs_sheets`만) — §Q5 수용 한계. PR-2에서 동기화.

## 커밋 (feat/sheet-builder-local)
1. `f103d28` feat(builder): 도메인 타입 + 순수 함수 (sheet.ts)
2. `120ee25` feat(builder): reducer 액션 + cs_sheets 로컬 영속 (동기화 무간섭)
3. `05f24b8` feat(builder): UI 컴포넌트 + 뷰 배선

`git push -u origin feat/sheet-builder-local` 예정. **PR 생성 안 함**(오케스트레이터가 QA 후 처리).
