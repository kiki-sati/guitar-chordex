# 구현 로그 · 코드 상세 "모든 폼" 팝업 → 화면 전환 (최소 범위)

브랜치: `feat/chord-detail-screen`
설계 정본: `_workspace/25_mobile_detail_view_plan.md` (§확정안) + 사용자 최소 범위 확정
방식: TDD (react-tdd-implementation). Red → Green → Refactor, 커밋은 단계별.

## 범위 확정 (사용자)

- 포함: 상세 화면 전환(모달 제거) · 뒤로가기 3종 수렴(UI ←, 브라우저/PWA, Android HW) · 데스크톱도 화면 전환 통일(max-width 720px 중앙).
- 제외(후속 PR): 사전(DictionaryView) 모바일 개선(§6.4 미디어쿼리/RootPills/ChordCard) · 홈 진입점 추가 · 스크롤 복원 · 스티키 툴바.

## 관측(착수 시점 실측)

- 톤칩 생략음 UX(`omittedInVoicing`, `omit-badge`, `tonesOmittedCaption`)는 **이미 main에 머지**되어 `ChordDetailModal.tsx`에 존재 → 2-패스 불필요, 1-패스로 그대로 이관.
- `ChordCard.onOpenDetail(chord)` → `dispatch OPEN_DETAIL` (진입점 무변경 확인).
- App.tsx backButton 리스너는 `state.detailChord` 우선순위 기반 → view='chordDetail'에서도 무변경으로 정합.
- `useAuth`는 provider 부재 시 `local-mode` 기본값 반환 → App 전체 렌더 테스트 가능.

## 단계별 (파일 · 테스트)

### Step 1 — reducer 상태 전환 (additive)
- `src/state/appReducer.ts`
  - `View` 유니온에 `'chordDetail'` 추가.
  - `AppState.detailReturnView: View` 추가, `initState` 기본값 `'dictionary'`.
  - `OPEN_DETAIL`: `view='chordDetail'` 전환 + 재진입 가드(`state.view==='chordDetail' ? state.detailReturnView : state.view`)로 진입 뷰 캡처.
  - `CLOSE_DETAIL`: `detailChord=null` + `view = state.view==='chordDetail' ? detailReturnView : state.view` (멱등).
  - `HYDRATE`: spread로 `detailReturnView` 자동 보존(추가 코드 없음).
  - **호출부(dispatch) 무변경** — DictionaryView/ChordCard 안 건드림.
- 테스트: `appReducer.test.ts`(OPEN→chordDetail+returnView 기록 / from home / 재진입 가드 / CLOSE 복귀 / 비상세 멱등 / initState 기본값), `appReducer.hydrate.test.ts`(detailReturnView 보존).

### Step 2 — ChordDetailView 컴포넌트
- 신규 `src/components/ChordDetailView.tsx` — 모달 본문(톤칩 + 캡션 + 보이싱 그리드 + 폼별 "X 생략" 배지) 그대로 이관 + 상단 앱바(← 뒤로 / 코드명 / ♥ 담기). 모달 셸(scrim/dialog/aria-modal/stopPropagation) 제거.
  - props: `{ detail, onBack, onCollect }` (`onClose`→`onBack` 개명).
  - `form-card` testid 추가(폼 개수 검증용).
- 신규 `src/components/ChordDetailView.module.css` — 토큰만. 앱바(sticky, 세이프에어리어 이중 적용 금지) + `.content max-width:720px 중앙` + 반응형 그리드(mobile 2열 / ≥600px 3열 / ≥900px 기존 minmax 132px 밀도) + `.circBtn` 44px 히트영역(::after). `.tone`/`.formCard`/`.omitBadge` 시각 토큰 유지.
- 신규 i18n: `ko.detailBack = '뒤로가기'`.
- 테스트: `ChordDetailView.test.tsx`(ALL VOICINGS 라벨+폼 n개 / dialog·aria-modal 부재 / ← onBack / ♥ onCollect CollectedChord shape / 생략배지·캡션 이관 회귀 — 구 ChordDetailModal.test 케이스 이관).

### Step 3 — App.tsx 배선 + 모달 제거
- `src/App.tsx`
  - import `ChordDetailModal` → `ChordDetailView`.
  - 뷰 스위치에 `case 'chordDetail'` 추가(detailChord null이면 HomeView 폴백).
  - 기존 `{state.detailChord ? <ChordDetailModal/> : null}` 오버레이 블록 삭제.
  - `headerTitles[state.view] ?? ['','','']`로 안전화 + `isDetail`이면 Header 미렌더(상세는 자체 앱바; 전체 화면 전환). Sidebar는 유지.
- 삭제: `ChordDetailModal.tsx` / `.module.css` / `__tests__/ChordDetailModal.test.tsx`(테스트 이관 완료 — 죽은 코드 제거).
- 테스트: `App.smoke.test.tsx` 갱신 — "카드 모든 폼 탭 → ALL VOICINGS(스크림 없이, dialog 부재) → 앱바 뒤로가기 탭 → 사전(코드 검색 placeholder) 복귀".

### Step 4 — 톤칩 생략음 UX 계승
- 이미 머지되어 Step 2에서 그대로 이관 완료(별도 단계 불필요).

### Step 5 — 상세 화면 반응형
- Step 2의 CSS에 함께 반영(그리드 2/3/auto열, max-width, 앱바 sticky, 44px 히트영역).

### Step 6 — 브라우저 history 어댑터 (웹 전용)
- 신규 `src/hooks/useDetailHistory.ts` — `(detailChord, dispatch)`.
  - 열림(null→non-null): `history.pushState({csDetail:true},'')` 1개.
  - `popstate` + 열림: `dispatch(CLOSE_DETAIL)`, 가드 플래그 세팅.
  - 프로그램적 닫힘(non-null→null): popstate 유발이 아니고 `history.state?.csDetail`이면 `history.back()` 1회(재귀 가드).
  - `Capacitor.isNativePlatform()` → 전체 no-op(HW 리스너 위임).
  - popstate 리스너는 마운트당 1회; 최신 열림 여부는 openRef로 참조.
- App.tsx에서 `useDetailHistory(state.detailChord, dispatch)` 배선.
- 테스트: `useDetailHistory.test.ts`(open→push 1 / popstate→CLOSE / 비열림 popstate no-op / 프로그램 close→back 1 / popstate close→back 안함(가드) / native no-op).

### Step 7 — Android HW 뒤로가기 검증
- App.tsx backButton 로직 **무변경**(detailChord 우선순위가 이미 정합).
- 테스트: `src/__tests__/App.backButton.test.tsx`(vi.hoisted로 @capacitor/core·app mock, backButton 콜백 캡처) — 상세 열림→CLOSE_DETAIL만(exitApp·홈이동 없음) / 비상세+view≠home→홈 / home→exitApp. 이중 pop 없음.

### Step 8 — 사전 모바일 개선
- **범위 제외**(사용자 확정) — DictionaryView/RootPills/ChordCard 변경 없음.

## 검증 (최종 커밋 상태)

- `npx tsc -b` → 0.
- `npm test` → 전체 그린 (아래 §검증결과).
- `npm run build` → 0.

## 변경 파일 맵

신규:
- `src/components/ChordDetailView.tsx`, `src/components/ChordDetailView.module.css`
- `src/components/__tests__/ChordDetailView.test.tsx`
- `src/hooks/useDetailHistory.ts`, `src/hooks/__tests__/useDetailHistory.test.ts`
- `src/__tests__/App.backButton.test.tsx`
- `_workspace/28_chord_detail_screen_impl.md`(본 문서)

변경:
- `src/state/appReducer.ts`, `src/App.tsx`, `src/i18n/strings.ts`
- `src/state/__tests__/appReducer.test.ts`, `src/state/__tests__/appReducer.hydrate.test.ts`
- `src/App.smoke.test.tsx`
- `_workspace/25_mobile_detail_view_plan.md`(브랜치에 커밋 — docs)

삭제:
- `src/components/ChordDetailModal.tsx`, `src/components/ChordDetailModal.module.css`, `src/components/__tests__/ChordDetailModal.test.tsx`

변경 없음(범위 가드): `src/domain/**`, `src/state/{sync,repo,persist,mappers}*`·`src/sync/**`, builder 파일, `DictionaryView.tsx`, `AuthGate/LoginScreen`.
