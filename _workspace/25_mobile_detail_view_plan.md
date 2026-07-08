# 기능: 코드 상세 "모든 폼" — 팝업 → 화면 전환 + 코드 사전 모바일 친화 개선

작성: architect · 대상: implementer / qa-verifier
전제: 사용자가 **디자인 방향 변경을 명시 지시**함 → 원본 SoT의 "모달" 패턴 이탈이 승인된 상태.
시각 토큰(`tokens.css`)·다이어그램 스타일(`ChordDiagram`, `variant="tones"`)·보이싱 그리드의 시각 결과는 **유지**한다. 바뀌는 것은 "담는 그릇"(모달 셸 → 전용 화면)과 소화면 레이아웃뿐이다.

> 이 문서 하나가 implementer의 단일 입력원이다. 도메인(`src/domain/*`)·동기화(`src/sync/*`, `src/state/persist*`, repository)·인증(`src/auth/*`)은 **일절 건드리지 않는다**(아래 §5 파일 맵에서 "변경 금지"로 못박음).

---

## 0. 배경: 현재 구조 관측 (읽기 결과)

| 항목 | 현재 상태 | 근거 파일 |
|------|-----------|-----------|
| 상세 진입 | `dispatch({type:'OPEN_DETAIL', chord})` → `state.detailChord: ChordDetail\|null` 세팅 | `appReducer.ts` L67·L134-144 |
| 상세 렌더 | `App.tsx`에서 `state.detailChord ? <ChordDetailModal/> : null` (오버레이 팝업) | `App.tsx` L73-79 |
| 진입점(2곳) | ① `DictionaryView` → `ChordCard.onOpenDetail` ② 검색 결과 카드도 동일 | `DictionaryView.tsx` L17·L41-99 |
| 홈 진입점 | HomeView의 추천 카드는 **OPEN_DETAIL을 호출하지 않는다** (정적 다이어그램 + disabled "듣기"뿐) | `HomeView.tsx` L64-76 |
| Android 뒤로가기 | `App.tsx`에 `@capacitor/app` `backButton` 리스너 **이미 존재**: `detailChord`면 CLOSE_DETAIL → view≠home이면 home → home이면 exitApp | `App.tsx` L24-38 |
| 톤 칩 생략음 UX | **아직 없음**. 현 모달은 `INTERVALS`로 톤을 뽑아 단순 칩만 렌더 | `ChordDetailModal.tsx` L23-25·L57-63 |
| 사전 툴바 | flex-wrap + search `margin-left:auto`. 모바일 미디어쿼리 없음(툴바 자체는 global.css 미대상) | `DictionaryView.module.css` L1-26 |
| 셸 반응형 | `global.css`에 `@media(max-width:820/600/440)` 존재 — 사이드바가 상단 가로바로 전환, `.view-pad` 패딩 축소 | `global.css` L77-129 |
| 세이프에어리어 | `App.module.css` `.shell`에 `env(safe-area-inset-*)` 패딩 + `100dvh` 이미 적용 | `App.module.css` L1-23 |

### 0.1 병행 브랜치 실측 (중요 — 충돌 면적 확정)

이 트리는 **`feat/sheet-builder-local` 브랜치 위**이며 빌더 구현이 **진행 중**이다. `git status`:
- `M src/state/appReducer.ts` — 빌더 상태(`sequence`/`armedChord`/`sheetTitle`/`SET_TIME_SIG`/`ARM_CHORD`/`PLACE_AT` 등) 이미 추가됨(uncommitted).
- `M src/i18n/strings.ts` — `builder*` 문자열 이미 존재.
- `?? sheet-persist.ts`, `sheet-persist.test.ts`, `appReducer.builder.test.ts` — 신규.
- `View` 타입에는 **이미 `'builder'`가 있다**(`appReducer.ts` L16-22, 커밋됨).
- **아직 없는 것**: `src/views/BuilderView*.tsx` 컴포넌트, `App.tsx`의 builder 라우팅(현재 L54-55 `default` 폴백 주석만). → 다른 에이전트가 **지금 App.tsx·reducer를 편집 중**이다.

`fix/chord-modal-tone-chips` 브랜치는 **아직 이 트리에 머지되지 않았다**: `src/domain/voicing-pcs.ts` 부재 확인.

> **결론**: 본 설계의 최고 충돌 파일은 `App.tsx`(라우팅 스위치)와 `appReducer.ts`(View 유니온·Action 유니온·AppState 필드)이다 — **둘 다 빌더 에이전트가 편집 중**. 그래서 §7 "구현 착수 시점"에서 **두 브랜치 머지 완료 후 착수**를 강제하고, 본 작업은 그 위에서 additive(추가만)로 설계한다.

---

## 1. 수용 기준 (모바일 뷰포트에서 관측 가능하게)

QA는 `preview_resize`(mobile 375×812 / tablet 768×1024 / desktop 1280×800)로 관측한다.

### A. 화면 전환(팝업 제거)
- **AC-1** 사전/검색 카드의 "모든 폼"(grid 아이콘) 또는 카드 본문을 탭하면, **오버레이 스크림 없이** 전체 화면이 코드 상세 화면으로 **전환**된다(기존 뷰가 상세 화면으로 대체됨). `role="dialog"`·`aria-modal` 스크림 DOM이 더 이상 존재하지 않는다.
- **AC-2** 상세 화면 상단에 **앱바**가 있다: 좌측 `←`(뒤로) 버튼(aria-label 뒤로가기), 중앙/좌측 코드명, 우측 담기(♥) 액션. 앱바는 스크롤해도 상단 고정(sticky)이다.
- **AC-3** 상세 화면 본문은 기존 모달과 **동일한 정보**를 렌더한다: 톤 칩 행 + `allVoicings` 그리드(각 폼 카드 = `ChordDiagram variant="tones"` + 위치 라벨 + 액션 3버튼). 폼 개수 라벨(`ko.allVoicings(n)`) 표시.
- **AC-4** 상세 화면에서 폼 카드의 ♥(담기)를 누르면 기존과 동일하게 `COLLECT` dispatch되고 토스트가 뜬다(도메인/collected 동작 불변).

### B. 뒤로가기 3종 (일관 동작)
- **AC-5 (UI 버튼)** 앱바 `←`를 누르면 상세를 닫고 **진입 직전 뷰로 복귀**한다. 사전에서 진입했으면 사전으로, (후속 홈 진입 연결 시) 홈에서 진입했으면 홈으로. 스크롤 위치는 복원 요건 아님(후속).
- **AC-6 (브라우저/PWA 뒤로가기)** 모바일 웹/PWA에서 브라우저 뒤로가기(또는 제스처)를 하면 상세가 닫히고 진입 뷰로 복귀한다. 상세를 연 것이 **history 항목 1개를 소비**하므로, 브라우저 앞으로가기로 다시 상세를 열 수 있다(자연스러운 동작).
- **AC-7 (Android 하드웨어 뒤로가기)** 네이티브(Capacitor)에서 하드웨어 뒤로가기를 하면 상세가 열려 있을 때 상세만 닫힌다(앱 종료·뷰 이동 아님). 상세가 닫힌 상태에서는 기존 규칙(view≠home→home, home→exitApp) 유지.
- **AC-8** 위 3종 뒤로가기는 **모두 동일한 최종 상태**로 수렴한다(상세 닫힘 + 진입 뷰 표시). 이중 pop(두 칸 뒤로) 등 불일치가 없다.

### C. 상세 화면 모바일 레이아웃
- **AC-9 (mobile 375px)** 보이싱 그리드가 **2열**로 렌더된다. 폼 카드가 가로로 넘치지 않는다(body 가로 스크롤 0).
- **AC-10 (tablet 768px)** 보이싱 그리드가 **3~4열**로 렌더된다.
- **AC-11 (desktop ≥1024px)** 보이싱 그리드가 기존 밀도(auto-fill minmax≈132px)로 렌더되고, 콘텐츠는 `max-width`로 중앙 정렬되어 초광폭에서 늘어지지 않는다.
- **AC-12 (터치 타깃)** 앱바 버튼·폼 액션 버튼의 탭 영역이 **≥44×44px**이다(시각 원형은 유지하되 hit-area 확장 허용).
- **AC-13 (세이프에어리어)** 앱바 상단이 `env(safe-area-inset-top)`을 존중해 노치/상태바에 가리지 않는다(셸 패딩과 이중 적용되지 않게 §6.3에서 조정).

### D. 코드 사전 모바일 친화 (경계 있는 범위 — 사전 흐름 한정)
- **AC-14 (툴바)** mobile에서 툴바(키/루트 세그먼트·검색)가 세로로 겹치지 않고 정돈된다. 검색 입력이 소화면에서 잘리지 않는다(고정 210px 폭 → 유동). 툴바는 스크롤 시 상단 sticky(선택 — §6.4 권장안).
- **AC-15 (루트 12칩)** 루트 선택 칩이 mobile에서 **가로 스크롤**되거나 2줄로 줄바꿈되어, 화면 밖으로 잘리지 않는다(현 `RootPills` 동작 확인 후 최소 보정).
- **AC-16 (카드 그리드)** mobile에서 코드 카드 그리드가 2열(또는 minmax 축소로 2~3열)로 촘촘하게 렌더되고, 카드 액션 버튼 탭 영역이 손가락으로 누를 만하다.
- **AC-17 (범위 가드)** 홈·스케일·연습·빌더 뷰의 레이아웃은 **변경되지 않는다**(사전 흐름 + 상세 화면에 한정). 앱 전체 리디자인 아님.

### E. 회귀·비변경 불변식
- **AC-18** `npm run build`(tsc -b + vite build)·`npm test` 그린.
- **AC-19** 도메인 함수(`allVoicings`/`computeDiagram`/`buildChord`/`INTERVALS`)·동기화·인증·persist 키(`cs_*`)·collected 동작이 **바이트 불변**.
- **AC-20** 빌더 뷰/상태(`sequence`/`armedChord`/`SET_TIME_SIG` 등)와 충돌·회귀 없음. 빌더 진입/저장/로드 스모크 통과.

---

## 2. 네비게이션 설계 (확정안 + 트레이드오프)

### 2.1 핵심 결정: 상태를 어디에 둘 것인가

세 후보를 검토했다.

| 안 | 개요 | 장점 | 단점 |
|----|------|------|------|
| **(A) View에 `'chordDetail'` 추가 + 복귀 스택** | `detailChord`는 유지, 뷰를 `'chordDetail'`로 전환. 진입 직전 뷰를 `returnView`에 저장 | reducer 순수 유지·테스트 쉬움·기존 SET_VIEW 라우팅 재사용 | 브라우저/HW 뒤로가기를 별도 배선해야 함 |
| **(B) history(pushState) 단일화** | 상세 열기 = `history.pushState`, 닫기 = `history.back()`. `popstate`가 유일한 닫기 경로 | 브라우저 뒤로가기 공짜·history 정합 자동 | React state와 history의 이중 소스 동기화 지옥. 테스트(jsdom popstate) 취약. 빌더·기존 SET_VIEW는 history를 안 쓰는데 상세만 쓰면 모델 불일치 |
| **(C) 상태 기반 + 얇은 history/HW 어댑터** | **상태가 단일 진실원**(A). 그 위에 "상세 열림"을 history 1엔트리 + HW 리스너에 **미러링**하는 얇은 어댑터. 모든 닫기는 결국 `CLOSE_DETAIL` 하나로 수렴 | 순수 reducer 유지 + 3종 뒤로가기 일관 + 테스트 가능 | 어댑터 1개(effect) 추가 — 복잡도 소폭 |

**확정: (C) — 상태 단일 진실원 + 얇은 뒤로가기 어댑터.**

이유:
- reducer는 순수해야 한다(CLAUDE.md CRITICAL). history를 reducer에 넣을 수 없다 → (B) 탈락.
- 빌더/기존 뷰가 이미 순수 상태 기반 라우팅(SET_VIEW)이다. 상세만 history 기반이면 모델이 갈라진다.
- 3종 뒤로가기는 "결국 `CLOSE_DETAIL` 하나를 부른다"로 통일 → **이중 pop·불일치(AC-8) 원천 차단**.

### 2.2 확정 상태 모델 (additive — 기존 필드 유지)

`AppState`에 필드 1개 추가, `View` 유니온에 값 1개 추가, Action 1개 추가.

```ts
// appReducer.ts — View 유니온에 'chordDetail' 추가 (빌더 머지 후 additive)
export type View =
  | 'home' | 'dictionary' | 'scales' | 'practice' | 'builder' | 'lesson'
  | 'chordDetail';  // ← 신규

export interface AppState {
  // ...기존 전부 유지 (빌더 sequence/armedChord/... 포함)...
  detailChord: ChordDetail | null; // 유지 (상세 데이터)
  detailReturnView: View;          // ← 신규: 상세 진입 직전 뷰 (복귀 대상)
}
```

`detailReturnView`는 `'chordDetail'` 자신을 담지 않도록 OPEN 시에만 기록한다(§2.3 가드).

### 2.3 Action 재설계 (기존 OPEN/CLOSE_DETAIL 의미 확장)

기존 `OPEN_DETAIL`/`CLOSE_DETAIL`을 **그대로 재사용하되 뷰 전환 책임을 추가**한다(새 액션 최소화). 단, "어느 뷰에서 열렸나"를 알아야 하므로 payload에 진입 뷰를 싣거나 reducer가 현재 `state.view`를 읽는다 — reducer는 `state`를 갖고 있으므로 **현재 view를 그대로 returnView로 캡처**하면 payload 확장 불필요.

```ts
case 'OPEN_DETAIL':
  return {
    ...state,
    detailChord: { root: action.chord.root, qualKey: action.chord.qualKey, name: action.chord.name },
    detailReturnView: state.view === 'chordDetail' ? state.detailReturnView : state.view, // 재진입 가드
    view: 'chordDetail',
  };

case 'CLOSE_DETAIL':
  // 상세가 아닐 때 호출돼도 안전(멱등): view가 chordDetail일 때만 복귀
  return {
    ...state,
    detailChord: null,
    view: state.view === 'chordDetail' ? state.detailReturnView : state.view,
  };
```

- `OPEN_DETAIL`이 이미 `detailChord`를 세팅하던 자리에 `view` 전환만 얹는다 — **DictionaryView/ChordCard의 dispatch 호출부는 무변경**(진입점 코드 안 건드림).
- `initState`에 `detailReturnView: 'dictionary'`(안전 기본값) 추가.
- `HYDRATE`는 `view`/`detailChord`/`detailReturnView`를 spread로 보존(현행과 동일 — 트랜션트 비간섭). **동기화 무간섭 유지**.

### 2.4 뒤로가기 3종 배선 (모두 → `CLOSE_DETAIL`)

단일 수렴점: **모든 뒤로가기는 `dispatch({type:'CLOSE_DETAIL'})` 하나만 부른다.**

**(1) UI 버튼 (AC-5)** — 상세 화면 앱바 `←` → `onBack()` → `dispatch(CLOSE_DETAIL)`. 끝.

**(2) 브라우저/PWA 뒤로가기 (AC-6)** — `App.tsx`(또는 신규 `useDetailHistory` 훅)에 effect:
```
detailChord가 null→비null로 바뀌는 순간: history.pushState({csDetail:true}, '')
popstate 이벤트: if (state.detailChord) dispatch(CLOSE_DETAIL)   // 사용자가 뒤로 → 닫기
CLOSE_DETAIL로 상세가 프로그램적으로 닫힐 때(버튼/HW): history.state가 csDetail이면 history.back() 1회
```
- 위 규칙의 핵심은 **"열 때 pushState 1개, 닫을 때 정확히 그 1개만 소비"**. 버튼/HW로 닫으면 우리가 `history.back()`을 불러 push한 엔트리를 되감고, 브라우저 뒤로로 닫히면 popstate가 이미 소비했으므로 추가 back 없음.
- 재진입 가드 플래그(ref)로 popstate→dispatch와 dispatch→back의 상호 재귀를 끊는다(§6.2 상세).
- 웹 전용: `Capacitor.isNativePlatform()`이면 이 history 미러는 **끄고** (3) HW 리스너에 위임(모바일 웹뷰에서 history와 HW 이중 발화 방지). → **플랫폼 분기 1군데**.

**(3) Android 하드웨어 (AC-7)** — `App.tsx`에 **이미 있는** `backButton` 리스너를 그대로 활용. 현재:
```
if (state.detailChord) dispatch(CLOSE_DETAIL);
else if (view!=='home') SET_VIEW home;
else exitApp();
```
`detailChord` 기반이라 view='chordDetail'이어도 그대로 동작한다 → **로직 변경 거의 없음**. 단 §6.2에서 "상세일 때 view도 chordDetail"이 됐으므로 `else if (view!=='home')` 분기가 상세를 이중 처리하지 않도록 순서(detailChord 우선)만 확인. 현행 순서가 이미 옳다.

> **일관성 증명(AC-8)**: 3경로 모두 종착이 `CLOSE_DETAIL` 1회 → `view=detailReturnView`, `detailChord=null`. history back은 "우리가 push한 1엔트리"만 정확히 되감으므로 이중 pop 불가. 웹/네이티브는 (2)를 상호배타로 켜므로 이중 발화 불가.

### 2.5 데스크톱 처리 (§설계할것 4)

**확정: 전 플랫폼 화면 전환 단일화 + 데스크톱은 `max-width` 콘텐츠.**
- 사용자 요청("팝업 말고 화면 전환")을 전 플랫폼에 적용 → 분기 최소화(모달 코드 완전 제거, 유지보수 단순).
- 데스크톱 이질감은 상세 화면 본문을 `max-width: 720px`(기존 모달 폭) 중앙 정렬로 흡수 → 초광폭에서 그리드가 늘어지지 않음(AC-11).
- 트레이드오프: 데스크톱에서 "카드 클릭 → 전체 화면 전환"이 모달보다 맥락 상실이 크다. 이를 앱바 `←` + 브라우저 뒤로가기(AC-6)로 완화. 사용자가 명시적으로 팝업 제거를 원했으므로 이 트레이드오프를 수용한다.
- (대안 각주) 데스크톱만 모달 유지 = 컴포넌트 2벌·상태 분기·테스트 2배 → 단순함 원칙에 반해 기각.

---

## 3. 데이터 계약 / 검증 경계면

| 경계면 | 생산자 | 소비자 | 계약(shape) |
|--------|--------|--------|------------|
| 상세 진입 | `ChordCard.onOpenDetail(chord)` → `dispatch OPEN_DETAIL` | reducer | `Chord` → `detailChord: ChordDetail` + `view:'chordDetail'` + `detailReturnView:<이전 view>` |
| 상세 렌더 데이터 | `state.detailChord: ChordDetail` | `<ChordDetailView>` | `{root: RootIndex, qualKey: Quality, name: string}` (non-null 보장 — 라우팅에서 null 가드) |
| 보이싱 목록 | `allVoicings(root, qualKey)` | `<ChordDetailView>` 그리드 | `FretArray[]` (length 6 each) — **무변경** |
| 폼 기하 | `computeDiagram(frets)` | `ChordDiagram`/라벨 | `DiagramGeometry` — **무변경** |
| 톤 칩 | `INTERVALS[qualKey]` + `noteName` (현행) / (fix 머지 후) `voicing-pcs` 헬퍼 | 톤 칩 행 | `string[]` 톤 + (fix 후) 생략음 흐림 메타 — §4.2 |
| 담기 | 폼 카드 ♥ → `dispatch COLLECT` | reducer | `CollectedChord {name, frets, key}` — **무변경** |
| 뒤로 복귀 | `dispatch CLOSE_DETAIL` | reducer | `view ← detailReturnView`, `detailChord ← null` |
| 브라우저 뒤로 | `popstate` | history 어댑터 | 부작용: `detailChord` 존재 시 `CLOSE_DETAIL` |
| HW 뒤로 | `@capacitor/app backButton` | App effect | 부작용: `detailChord` 존재 시 `CLOSE_DETAIL` (기존 유지) |

**핵심 불변식**: 상세 화면은 도메인 계산을 **직접 하지 않는다** — `allVoicings`/`computeDiagram`/`INTERVALS` 호출만(현 모달과 동일). UI에 음악 로직 유입 금지(CLAUDE.md).

---

## 4. 컴포넌트 설계

### 4.1 `ChordDetailModal` → `ChordDetailView` 이관 (§설계할것 5)

**처분: 개명·이관(재작성 아님). 모달 셸(scrim/dialog) 제거, 본문 로직은 최대한 보존.**

- 신규 `src/components/ChordDetailView.tsx` = 기존 `ChordDetailModal.tsx`의 **본문(톤 칩 + 그리드 + 폼 카드)을 그대로 이식** + 상단 앱바로 감싸기. `scrim`/`role=dialog`/`aria-modal`/`onClick stopPropagation` 제거.
- props: `{ detail: ChordDetail; onBack: () => void; onCollect: (c: CollectedChord) => void }` (기존 `onClose` → `onBack`으로 개명, 의미 동일).
- 신규 `src/components/ChordDetailView.module.css` = 기존 `ChordDetailModal.module.css`에서 `.scrim`/`.modal` 셸 제거, `.appbar`/`.appbarBtn`/`.content(max-width)` 추가, `.grid` 반응형화(§6.1). 나머지(`.tone`/`.formCard`/`.circBtn`)는 토큰 그대로 재사용.
- 기존 `ChordDetailModal.tsx` + `.module.css`는 **삭제**(더 이상 참조 없음 — App.tsx에서 교체).

컴포넌트 트리:
```
App/Shell
 └─ (view==='chordDetail') ChordDetailView
      ├─ DetailAppBar (← / 코드명 / ♥ 담기)   ← ChordDetailView 내부 마크업(별도 컴포넌트 불필요)
      ├─ ToneChipRow  (톤 칩; fix 머지 후 생략음 흐림)
      └─ VoicingGrid
           └─ FormCard × N (ChordDiagram variant="tones" + 라벨 + [▶ disabled ♥ ⧉ disabled])
```
> `App.tsx`의 뷰 스위치에 `case 'chordDetail': view = <ChordDetailView detail={state.detailChord!} .../>` 추가. `state.detailChord`가 null이면 라우팅이 상세를 렌더하지 않도록 가드(`view==='chordDetail' && !detailChord` → home 폴백). 기존 `{detailChord ? <ChordDetailModal/> : null}` 오버레이 블록은 **삭제**.

### 4.2 톤 칩 생략음 UX 계승 (`fix/chord-modal-tone-chips` 머지 후)

- fix 브랜치는 `src/domain/voicing-pcs.ts`(신규 순수 헬퍼)와 i18n 키를 추가해, 모달 톤 칩에 "실제 보이싱에서 생략된 음을 흐리게 + 캡션" UX를 넣는다.
- **본 설계는 그 코드를 상세 화면으로 이관/재사용한다.** 구체:
  - fix가 `ChordDetailModal.tsx`에 넣은 톤 칩 렌더 로직(생략음 판정·흐림 클래스·캡션)을 `ChordDetailView`의 `ToneChipRow` 부분에 **그대로 옮긴다**.
  - `voicing-pcs.ts`(도메인)·i18n 키는 **재사용만 하고 수정하지 않는다**.
- **순서 의존성**: 이 단계(§7 Step 4)는 fix 브랜치가 머지되어 `voicing-pcs.ts`가 트리에 있을 때만 착수. 머지 전이면 현행 단순 톤 칩(`INTERVALS`)으로 먼저 이관하고, 머지 후 흐림 UX를 얹는 **2-패스**로 분해(둘 다 §7에 단계로 존재).

---

## 5. 파일 맵 (신규 / 변경 / 변경 금지)

### 신규
| 파일 | 내용 |
|------|------|
| `src/components/ChordDetailView.tsx` | 상세 화면(앱바 + 톤칩 + 보이싱 그리드). 모달 본문 이식 |
| `src/components/ChordDetailView.module.css` | 상세 화면 스타일(토큰만; 반응형 그리드·앱바·max-width) |
| `src/components/__tests__/ChordDetailView.test.tsx` | 렌더·담기·onBack 콜백 단위 테스트 |
| `src/hooks/useDetailHistory.ts` *(선택, 권장)* | 브라우저 history 미러 어댑터(웹 전용). App.tsx 비대화 방지 |
| `src/hooks/__tests__/useDetailHistory.test.ts` *(선택)* | pushState/popstate/back 미러 로직 테스트 |

### 변경 (additive 위주)
| 파일 | 변경 | 충돌 위험 |
|------|------|-----------|
| `src/state/appReducer.ts` | `View`에 `'chordDetail'` 추가 · `AppState.detailReturnView` 추가 · `OPEN_DETAIL`/`CLOSE_DETAIL`에 view 전환 · `initState` 기본값 | **높음** (빌더 에이전트 편집 중 — 같은 유니온/AppState) |
| `src/App.tsx` | 뷰 스위치에 `case 'chordDetail'` · 기존 모달 오버레이 블록 삭제 · (웹) history 어댑터 배선 · HW 리스너는 거의 유지 | **높음** (빌더 라우팅과 같은 스위치·같은 파일) |
| `src/views/DictionaryView.module.css` | 툴바/검색/그리드 모바일 미디어쿼리(AC-14/16) | 낮음 |
| `src/components/RootPills.module.css` (또는 DictionaryView `.roots`) | 루트 칩 가로 스크롤/줄바꿈(AC-15) — **읽고 최소 보정** | 낮음 |
| `src/components/ChordCard.module.css` | (필요 시) 모바일 카드 액션 터치 영역 ≥44px(AC-16/12) | 낮음 |
| `src/i18n/strings.ts` | 앱바 뒤로가기 aria 라벨 등 신규 키(예: `detailBack`) | 낮음(추가) |
| `src/App.smoke.test.tsx` | "opens and closes the chord detail modal" 테스트를 **화면 전환 기준으로 갱신**(§8 회귀) | 중간 |

### 변경 금지 (명시)
- `src/domain/**` 전부 — `voicing.ts`/`diagram.ts`/`chord.ts`/`constants.ts`/`notes.ts`/`voicing-pcs.ts`(fix 머지분 재사용만)/`sheet.ts`.
- `src/sync/**`, `src/state/persist*.ts`, `src/state/*repository*.ts`, `src/state/mappers*`, `src/state/RepoBoundary*`, `src/state/MigrationController*` — **동기화·persist 계층 무변경**. persist 키(`cs_*`) 불변.
- `src/auth/**`, `src/lib/supabase.ts`, `src/native.ts`(딥링크/appState — 상세와 무관. HW backButton은 App.tsx에 있으므로 native.ts는 안 건드림).
- 빌더 관련: `src/domain/sheet.ts`, `src/state/sheet-persist.ts`, (등장 예정) `BuilderView*` — **읽지도 수정도 안 함**(additive 병존).
- `tokens.css` — 색/토큰 추가·변경 금지(있는 토큰만 사용).

---

## 6. CSS / 레이아웃 설계 (토큰만)

### 6.1 상세 화면 보이싱 그리드 반응형 (AC-9/10/11)
```
.content { max-width: 720px; margin: 0 auto; padding: 16px 16px 56px; }
.grid { display:grid; gap: var(--s-sm); grid-template-columns: repeat(2, 1fr); } /* mobile 기본 2열 */
@media (min-width: 600px) { .grid { grid-template-columns: repeat(3, 1fr); } }   /* tablet 3열 */
@media (min-width: 900px) { .grid { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); } } /* desktop 기존 밀도 */
```
> 모바일-퍼스트: 기본 2열 → 넓어질수록 열 증가. 기존 모달의 `minmax(132px,1fr)` 밀도는 desktop 구간에서 복원.

### 6.2 앱바 (AC-2/12/13)
```
.appbar {
  position: sticky; top: 0; z-index: 10;
  display:flex; align-items:center; gap: var(--s-xs);
  padding: 10px 12px; background:#fff; border-bottom:1px solid var(--c-border);
  /* 세이프에어리어: 셸이 이미 inset-top 패딩을 주므로 여기선 추가하지 않음(이중 방지) */
}
.appbarBtn { /* ← 및 ♥ */
  min-width:44px; min-height:44px; display:flex; align-items:center; justify-content:center;
  border-radius: var(--r-full); border:1px solid var(--c-border); background:#fff; cursor:pointer;
}
.appbarTitle { font-size:20px; font-weight:700; letter-spacing:-0.4px; margin-right:auto; }
```
- **세이프에어리어 이중 적용 방지(AC-13)**: `App.module.css .shell`이 이미 `env(safe-area-inset-top)` 패딩을 준다. 상세 앱바는 그 안쪽에 sticky top:0로 붙으므로 inset을 **다시 더하지 않는다**. QA는 노치 기기(또는 devtools inset emulation)에서 앱바가 상태바에 안 가리는지 관측.

### 6.3 히스토리 어댑터 재귀 가드 (구현 노트)
- `openedByUsRef`(boolean): OPEN으로 pushState할 때 true. popstate 핸들러는 "우리가 연 상세가 열려있으면 CLOSE_DETAIL". CLOSE가 프로그램적으로 발생(버튼/HW)했고 `history.state?.csDetail`이면 `history.back()` 1회 후 ref 리셋.
- `Capacitor.isNativePlatform()` 분기: 네이티브면 history 미러 전체 skip(HW 리스너가 담당). 웹이면 history 미러만, HW 리스너는 네이티브 가드로 자동 no-op(현행 `if(!isNativePlatform) return`).
- effect 의존성: `[state.detailChord]`. cleanup에서 popstate 리스너 remove.

### 6.4 사전 툴바/루트/카드 모바일 (AC-14~16)
```
/* DictionaryView.module.css */
@media (max-width: 560px) {
  .toolbar { gap: 8px; }
  .search { margin-left: 0; width: 100%; }        /* 검색 전폭 */
  .searchInput { width: 100%; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; } /* 더 촘촘 → 2~3열 */
}
/* 루트칩: 가로 스크롤 (RootPills 래퍼 .roots) */
.roots { overflow-x: auto; -webkit-overflow-scrolling: touch; }
```
- **RootPills 먼저 읽기**: 이미 wrap/스크롤이면 중복 금지. 없으면 `.roots`에 가로 스크롤만 최소 추가.
- 스티키 툴바는 선택(AC-14 "선택"). 권장: 소화면에서만 `.toolbar { position: sticky; top:0; background:#fff; z-index:5; }` — 단, 셸 뷰포트 스크롤 컨테이너 기준 동작 확인 후 결정(위험하면 생략).

---

## 7. 빌드 순서 (작은 커밋 · TDD)

> **착수 전제(강제)**: `feat/sheet-builder-local`과 `fix/chord-modal-tone-chips`가 **둘 다 main에 머지 완료**된 뒤, main에서 새 브랜치 `feat/chord-detail-screen`를 파서 시작한다. 지금 트리(빌더 진행 중)에서 소스 편집 금지.

| Step | 내용 | 테스트(먼저) | 커밋 |
|------|------|--------------|------|
| **1. reducer 상태 전환** | `View`+`'chordDetail'`, `detailReturnView`, OPEN/CLOSE에 view 전환, initState 기본값, HYDRATE 보존 | `appReducer.test.ts`에 OPEN→view='chordDetail'·returnView 캡처·CLOSE→복귀·재진입 가드·HYDRATE 보존 케이스 | `feat(detail): route OPEN_DETAIL to chordDetail view + return stack` |
| **2. ChordDetailView 컴포넌트** | 모달 본문 이식 + 앱바. 모달 파일 삭제는 Step 3에서 | `ChordDetailView.test.tsx`: 톤칩 렌더·폼 개수·♥→onCollect·←→onBack | `feat(detail): ChordDetailView screen (appbar + voicing grid)` |
| **3. App.tsx 배선 + 모달 제거** | 뷰 스위치 case 추가, null 가드, 기존 모달 오버레이 블록 삭제, smoke 테스트 갱신 | `App.smoke.test.tsx` "화면 전환으로 열림/닫힘"으로 갱신(§8) | `refactor(detail): replace modal overlay with screen route` |
| **4. 톤 칩 생략음 UX 계승** | fix 머지분(`voicing-pcs`+i18n) 톤칩 로직을 ToneChipRow로 이관 | ChordDetailView 톤칩 흐림/캡션 케이스 | `feat(detail): carry over omitted-tone dimming into detail view` |
| **5. 상세 화면 반응형** | `.grid` 2/3/auto열, max-width, 앱바 터치 타깃, 세이프에어리어 조정 | (관측 QA) preview_resize mobile/tablet/desktop | `style(detail): responsive voicing grid + safe-area appbar` |
| **6. 브라우저 history 어댑터** | `useDetailHistory`(웹 전용) pushState/popstate/back 미러 + 네이티브 skip | `useDetailHistory.test.ts`: open→push, popstate→CLOSE, 버튼close→back 1회, native→no-op | `feat(detail): browser back closes detail (history mirror, web-only)` |
| **7. HW 뒤로가기 확인** | App.tsx 기존 backButton 리스너가 view='chordDetail'에서 올바로 CLOSE_DETAIL만 하는지 검증(대개 무변경) | `App` 레벨 backButton mock 테스트(§8) | `test(detail): android back closes detail (no double-pop)` |
| **8. 사전 모바일 개선** | DictionaryView/RootPills/ChordCard CSS 미디어쿼리(사전 흐름 한정) | preview_resize 관측 + 기존 DictionaryView.test 그린 | `style(dict): mobile-friendly toolbar/roots/card grid` |
| **9. 회귀 스위프** | build+test 그린, 빌더 스모크, 홈/스케일/연습 미변경 확인 | `npm run build && npm test` | (PR 마무리) |

**PR 단위(권장): 1개** — `feat/chord-detail-screen`. 상세 화면 전환·뒤로가기 3종·사전 모바일 개선은 **하나의 응집된 UX 변경**(사용자 요구 1건)이므로 분리하면 오히려 중간 상태가 어색(모달 없는데 화면도 없는 순간). 단 커밋은 위 9개로 잘게. PR이 과대해지면 **8번(사전 모바일)만 후속 PR로 분리 가능**(상세 화면과 독립적).

---

## 8. 테스트 케이스 (명세)

### reducer (`appReducer.test.ts` 추가)
- `OPEN_DETAIL`(from dictionary) → `view==='chordDetail'` && `detailReturnView==='dictionary'` && `detailChord` 세팅.
- `OPEN_DETAIL`(from home) → `detailReturnView==='home'`.
- `OPEN_DETAIL` 재호출(이미 chordDetail) → `detailReturnView` **불변**(이전 진입 뷰 유지, chordDetail로 덮이지 않음).
- `CLOSE_DETAIL`(view=chordDetail, return=dictionary) → `view==='dictionary'` && `detailChord===null`.
- `CLOSE_DETAIL`(view≠chordDetail) → **멱등**(view 불변, crash 없음).
- `HYDRATE` → `view`/`detailChord`/`detailReturnView` 보존(빌더 HYDRATE 테스트와 동형).

### ChordDetailView (`ChordDetailView.test.tsx`)
- detail 주입 → `ko.allVoicings(n)` 라벨 + 폼 카드 n개 렌더.
- ♥ 클릭 → `onCollect` 호출(payload `CollectedChord` shape).
- ← 클릭 → `onBack` 호출.
- (fix 머지 후) 생략음 톤 칩에 흐림 클래스/캡션 존재.
- 스크림/`role=dialog` **부재** 확인(모달 아님).

### history 어댑터 (`useDetailHistory.test.ts`, jsdom)
- 상세 열림 → `history.pushState` 1회 호출(spy).
- `popstate` 발화 + `detailChord` 존재 → `CLOSE_DETAIL` dispatch 1회.
- 프로그램적 close(버튼) → `history.back()` 1회, popstate로 인한 추가 dispatch 없음(가드).
- `isNativePlatform()===true` mock → pushState/popstate 리스너 **미등록**(no-op).

### Android backButton (App 레벨, native mock — `native.test.ts` 패턴 차용)
- `@capacitor/app` `backButton` 리스너 mock 캡처(기존 테스트 패턴).
- view='chordDetail'(detailChord 존재)에서 backButton → `CLOSE_DETAIL`만(SET_VIEW·exitApp 미호출).
- 상세 없음 + view='dictionary' → `SET_VIEW home`.
- 상세 없음 + view='home' → `exitApp`.
- **이중 pop 없음**: backButton 1회에 dispatch 1회만.

### smoke 회귀 (`App.smoke.test.tsx` 갱신)
- 기존 "opens and closes the chord detail modal"(L50-61)을 **화면 전환 기준으로 재작성**: 카드 "모든 폼" 탭 → `ALL VOICINGS` 노출(스크림 없이) → 앱바 `←`(aria-label 뒤로가기) 탭 → 사전 복귀(`코드 검색` placeholder 재노출), `ALL VOICINGS` 소멸. `role:'button', name:'close'`(× 버튼) 셀렉터는 제거/치환.

### 모바일 뷰포트 (QA 관측 — preview_resize)
- 375px: 상세 그리드 2열, body 가로 스크롤 0(AC-9), 사전 카드 2~3열(AC-16), 루트칩 스크롤(AC-15).
- 768px: 상세 그리드 3~4열(AC-10).
- 1280px: 상세 콘텐츠 max-width 중앙, 그리드 기존 밀도(AC-11).
- 앱바/폼 버튼 hit-area ≥44px(AC-12), 노치 emulation에서 앱바 미가림(AC-13).

---

## 9. 회귀 위험 & 완화

| 위험 | 영향 | 완화 |
|------|------|------|
| **빌더 브랜치 충돌**(App.tsx 뷰 스위치·appReducer View/AmpState) | 머지 컨플릭트·라우팅 회귀 | 착수 전 빌더 머지 완료 강제(§7 전제). 변경을 **additive**로만(유니온에 값 추가, 스위치에 case 추가). 빌더 `case 'builder'`와 나란히 `case 'chordDetail'` 추가 |
| **기존 모달 테스트 깨짐**(smoke의 `close`/`role=dialog`) | test red | §8에서 smoke 테스트를 화면 전환 기준으로 **동반 갱신**(같은 커밋 Step 3) |
| **history 이중 pop / 무한 popstate** | 뒤로가기 2칸/루프 | 재귀 가드 ref + native skip(§6.3). 어댑터 단위 테스트로 back 1회 검증 |
| **세이프에어리어 이중 패딩** | 앱바가 너무 아래로 밀림 | 셸이 이미 inset 제공 → 앱바는 inset 재적용 금지(§6.2) |
| **fix 톤칩 브랜치 미머지 상태 착수** | `voicing-pcs` 부재로 import 실패 | 2-패스: Step 2는 현행 `INTERVALS` 톤칩으로 이식, Step 4에서 fix 머지 후 흐림 UX 얹기 |
| **사전 CSS가 다른 뷰에 누수** | 홈/스케일 레이아웃 변형(AC-17 위반) | CSS Modules 스코프 유지 + `.view-pad` 같은 **전역 클래스는 건드리지 않음**. 미디어쿼리는 DictionaryView.module.css 안에서만 |
| **RootPills 중복 스크롤/줄바꿈** | 칩 레이아웃 깨짐 | 착수 시 RootPills.tsx/.module.css **먼저 읽고** 기존 동작 확인 후 최소 보정 |
| **동기화/persist 오염** | 계정 데이터 계약 위반 | detailReturnView는 트랜션트(HYDRATE spread 보존), persist 키·mappers·repository **무변경**(§5 변경 금지) |

---

## 10. 열린 질문 (오케스트레이터/사용자 확인 권장)

1. **홈 진입점**: 현재 HomeView 추천 카드는 OPEN_DETAIL을 호출하지 않는다(정적). "홈에서도 상세 진입" 요구가 있는가? 있으면 별도 소단계로 HomeView 추천 카드에 onOpenDetail 배선 추가(returnView='home' 자동). 없으면 이번 범위 제외.
2. **스크롤 위치 복원**: 사전에서 스크롤 내려 카드 탭 → 상세 → 뒤로 시 사전 스크롤 위치 복원이 필요한가? 이번 범위는 "뷰 복귀"까지만(스크롤 복원은 후속). 확인.
3. **사전 스티키 툴바**(AC-14 선택): 소화면 sticky 툴바를 넣을지, 단순 유동 정렬만 할지. 셸 스크롤 컨테이너 구조상 위험하면 생략 권장.
4. **PR 분할**: 상세 화면(전환+뒤로가기)과 사전 모바일 개선을 1 PR로 갈지, 사전 모바일(Step 8)만 별도 PR로 뺄지 — 규모 보고 결정(권장 1 PR, 커밋 분리).
5. **데스크톱 UX 승인**: "데스크톱도 전체 화면 전환 + max-width" 안(§2.5)이 수용 가능한가, 아니면 데스크톱만 모달 유지를 원하는가(복잡도 증가). 권장은 전 플랫폼 전환.
