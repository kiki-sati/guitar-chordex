# 설계 계획서 — 악보 빌더 (Sheet Builder)

> 작성: architect · 대상 뷰: `builder` · 정본: 디자인 SoT `기타 코드 연습 Figma.dc.html` (builderView 라인 604-672 외)
> 원칙: **디자인 정본의 시각/동작을 재현**하되 CSS Modules + 순수 도메인/reducer로 이식. 코드/보이싱/기하 로직은 기존 domain 함수 재사용(신규 계산 금지).
> 상태: 계획만. 구현은 사용자 체크포인트(§9 열린 질문) 후 시작.

---

## 0. 요약 (먼저 읽기)

- **정본에 빌더 스펙이 있는가? → 예, 완전하게 존재.** 디자인 정본 `builderView`(라인 604-672)와 헬퍼 메서드(라인 452-470, `armChord`/`placeAt`/`clearSlot`/`addMeasure`/`removeMeasure`/`setTimeSig`/`padSlots`/`saveSheet`/`loadSheet`/`deleteSheet`/`beatsOf`)가 UI·동작·데이터 구조를 모두 정의한다. request.md는 이를 후순위(§후속 단계)로 명시. "정본 부재"가 아니므로 임의 설계가 아니라 **이식**이 원칙.
- **핵심 재료:** `collected`(담은 코드) → 팔레트에서 "고르기(arm)" → 마디 격자의 빈 박을 클릭해 배치 → 제목·박자표 지정 → 저장 → `sheets` 목록. 저장된 악보는 연습 뷰의 드릴로 담을 수 있다(`addDrillFromSheet`, 이미 `Drill.seq/sheetId/timeSig` 슬롯 존재).
- **오디오(`strumSeq` ▶재생)와 클립보드는 정본에도 있으나 request.md 후속 → 이번 빌더 범위에서 제외**(버튼 비활성/숨김).
- **동기화 확장 비용이 실질적.** `sheets`는 신규 영속 슬라이스다 — `RepoChange`·`PersistedState`·`Repository`·`diffChanges`·`applyChanges`·`SupabaseRepository`·`mappers`·DB 테이블(RLS)까지 파급된다. 이 때문에 **PR을 2개로 분리**한다(§8).

---

## 1. 원본 정본에서 추출한 빌더 스펙 (있는 그대로)

### 1.1 상태 (원본 `AppComponent.state`, 라인 202)
```txt
sequence : (Slot|null)[]   // sparse. Slot = {name, frets}. 초기 8칸(4/4×2마디)
armedChord : {name,frets}|null   // 팔레트에서 "고른" 코드(토글). 배치 소스.
timeSig : '4/4' | '3/4' | '6/8'  // beatsOf: 4/4→4, 3/4→3, 6/8→6
sheetTitle : string              // 악보 제목(입력)
sheets : Sheet[]                 // 저장된 악보 목록(cs_sheets)
```
`seedExampleSheet()`(라인 214-218): 첫 로드 시 예시 악보 시퀀스 채움(제목 "캐논 진행 (예시)", 4/4). `lyrics`는 상태에 자리만 있고 빌더 UI에서 미사용 → **범위 제외**.

### 1.2 Sheet 저장 형태 (원본 `saveSheet`, 라인 468)
```txt
Sheet = { id:'sh'+ts, title, seq:Slot[](sparse 포함), timeSig, date:'YYYY-MM-DD' }
```
localStorage 키 **`cs_sheets`** (원본 `load`/`save`, 라인 227·238). 기존 `KEYS`에 없는 신규 키.

### 1.3 동작 (원본 헬퍼)
| 동작 | 원본 메서드 | 규칙 |
|------|------------|------|
| 코드 고르기(arm) | `armChord(ch)` (459) | 같은 코드 재클릭 → arm 해제(토글) |
| 박에 배치 | `placeAt(i)` (460) | armed 있으면 `seq[i]=armed`, 없으면 `seq[i]=null` |
| 박 비우기 | `clearSlot(i)` (461) | `seq[i]=null` |
| 마디 추가 | `addMeasure()` (462) | beats 개수만큼 null push |
| 마디 삭제 | `removeMeasure(mi)` (463) | 해당 마디 splice 후 `padSlots` (마디 2개 이상일 때만 버튼 노출) |
| 박자표 변경 | `setTimeSig(t)` (464) | timeSig 교체 + `padSlots(seq, newBeats)` |
| 슬롯 패딩 | `padSlots(seq,beats)` (458) | 길이가 beats 배수 되도록 null 채움. 빈 배열이면 beats×2 |
| 저장 | `saveSheet()` (468) | 채워진 박 0개면 토스트("코드를 먼저 넣어주세요") 후 중단. 아니면 sheets 앞에 추가 |
| 불러오기 | `loadSheet(sh)` (469) | seq/timeSig/title 복원(padSlots) |
| 삭제 | `deleteSheet(id)` (470) | sheets에서 제거 |
| 재생 | `strumSeq(seq)` | **오디오 — 후속. 이번 범위 제외.** |

### 1.4 셀 클릭 상호작용 (원본 `beatCell`, 라인 631)
- armed 있음 → 클릭 시 배치(`placeAt`).
- armed 없음 + 칸에 코드 있음 → 클릭 시 비우기(`clearSlot`).
- armed 없음 + 빈 칸 → 토스트("아래 담은 코드를 먼저 선택하세요").

### 1.5 화면 구성 (원본 `builderView`, 라인 604-672)
1. **sheet 카드**(라인 644): 제목 입력 + 박자표 세그(4/4·3/4·6/8) + [▶재생(후속)]·[비우기]·[저장] 버튼 → hint 배너 → 큰 제목/"N CHORDS" → chordBox(사용된 고유 코드 다이어그램) → **마디 격자**(`grid-template-columns: repeat(4, 1fr)`, 마디 단위 렌더, 각 마디는 beats 열) → [+ 마디 추가].
2. **팔레트**(라인 611): "담은 코드 · 클릭해서 선택" — collected를 다이어그램 카드 그리드로, arm 토글, ×제거, "고르기/✓선택됨" 라벨. 비었으면 "코드 사전에서 담기" 안내(사전 뷰 링크).
3. **saved**(라인 661): "저장된 악보 N" — 제목·`timeSig · N코드 · date` + [불러오기]·[삭제].

### 1.6 디자인 토큰/기하 (재현 대상)
- 팔레트 카드 폭 다이어그램 `72px`, chordBox 다이어그램 `72px`.
- armed 카드: `border 2px ink`, `background soft`. 미armed: `border 2px border`, `#fff`.
- 마디 격자: 각 마디 하단 경계 `2px ink`, 컨테이너 우측 경계 `2px ink`, 박 좌측 경계(마디 첫 박) `2px ink`/그 외 `1px line`. rowGap 22.
- 빈 박 기호: armed면 `+`(ink), 아니면 `·`(#d3d2cd). 채워진 박: 코드명 굵게 18px.
- 라운딩: sheet/saved 카드 16, chordBox 14, 팔레트 카드 9, 버튼 8.

---

## 2. 수용 기준 (테스트 관측 가능)

### 2.1 뷰 셸/네비 (PR-1)
- [ ] AC-1 사이드바 "악보 만들기" 버튼이 **활성화**되고, 클릭 시 `view==='builder'`로 전환된다. (기존 `disabled:true` → `false`)
- [ ] AC-2 `App.tsx` 라우팅에 `case 'builder'`가 추가되어 `<BuilderView>`가 렌더된다(폴백 HomeView 아님).
- [ ] AC-3 홈 board 레이아웃의 "악보 만들기 →" 버튼(`homeToBuilder`)이 활성화되어 클릭 시 builder 뷰로 이동한다.
- [ ] AC-4 헤더 eyebrow/title이 `headerTitles.builder`(이미 존재)로 표시된다.

### 2.2 빌더 도메인 (순수, PR-1)
- [ ] AC-5 `beatsOf('4/4')===4`, `'3/4'===3`, `'6/8'===6`.
- [ ] AC-6 `padSlots(seq, beats)`: 반환 길이는 beats의 배수. 빈 배열 입력 → 길이 `beats*2`. 기존 요소 보존.
- [ ] AC-7 `setTimeSig`로 4/4(8칸)→3/4 전환 시 시퀀스가 3의 배수 길이로 패딩된다(기존 배치 코드 유지).
- [ ] AC-8 `placeAt`/`clearSlot`/`addMeasure`/`removeMeasure`가 §1.3 규칙대로 sparse 배열을 변환한다(순수 함수 골든 테스트).
- [ ] AC-9 `sequenceToMeasures(seq, beats)`가 beats 단위로 분할한다. seq가 비면 최소 1개 빈 마디.

### 2.3 빌더 상호작용 (reducer, PR-1)
- [ ] AC-10 팔레트 코드 클릭 → `armedChord` set. 같은 코드 재클릭 → null(토글).
- [ ] AC-11 armed 상태에서 빈 박 클릭 → 해당 인덱스에 armed 코드 배치.
- [ ] AC-12 armed 없이 채워진 박 클릭 → 해당 박 비움.
- [ ] AC-13 armed 없이 빈 박 클릭 → 시퀀스 불변 + 안내 토스트.
- [ ] AC-14 "비우기" → 시퀀스가 `beats*2` 빈 칸으로 리셋.
- [ ] AC-15 "저장": 채워진 박 0개면 토스트 + `sheets` 불변. ≥1이면 `sheets` 맨 앞에 새 Sheet 추가 + 성공 토스트.
- [ ] AC-16 "불러오기" → sheetTitle/timeSig/sequence 복원.
- [ ] AC-17 "삭제" → 해당 id가 sheets에서 제거.
- [ ] AC-18 collected에서 코드 제거(×) 시 팔레트에서 사라진다(기존 `REMOVE_COLLECTED` 재사용).

### 2.4 영속화 (PR-1: 로컬)
- [ ] AC-19 `sheets`가 `cs_sheets`(prefix 규약 적용)로 저장/로드된다.
- [ ] AC-20 `sheetTitle`/`timeSig`/`sequence`/`armedChord`는 **트랜션트**(비영속). 저장된 것만 `sheets`로 남는다.
- [ ] AC-21 첫 방문 시드 악보 1개가 `sheets`에 채워진다(원본 `seedExampleSheet` 재현). *(→ §9 Q3 확인 필요)*

### 2.5 동기화 (PR-2)
- [ ] AC-22 `diffChanges`가 sheets upsert/delete를 `RepoChange`로 산출한다(id 자연키).
- [ ] AC-23 `applyChanges`가 sheet change를 멱등 적용한다(같은 change 2회 = 동일 결과).
- [ ] AC-24 인증 유저에서 sheet 저장/삭제가 Supabase `sheets` 테이블에 반영되고, 다른 기기 pull 시 복원된다(RLS로 user 격리).
- [ ] AC-25 기존 4슬라이스 동기화(grass/journal/drill/collected)에 회귀 없음.

### 2.6 빌드/회귀 (양 PR)
- [ ] AC-26 `npm run build`·`npm test` 통과.
- [ ] AC-27 기존 뷰(home/dictionary/scales/practice) 스냅샷/동작 회귀 없음.

---

## 3. 데이터 모델 / 타입

### 3.1 신규 도메인 타입 (`src/domain/types.ts`에 추가 — 기존 불변 유지)
```ts
// ── 악보 빌더 ──
export type TimeSig = '4/4' | '3/4' | '6/8';

// 한 박(beat) 슬롯: 배치된 코드 or 빈 칸(null)
export interface SheetSlot {
  name: string;
  frets: FretArray; // CollectedChord.frets와 동일 shape (불변)
}
export type SheetSequence = (SheetSlot | null)[];

// 저장된 악보 (원본 saveSheet 형태)
export interface Sheet {
  id: string;          // 'sh' + Date.now()
  title: string;
  seq: SheetSequence;  // sparse 포함
  timeSig: TimeSig;
  date: string;        // 'YYYY-MM-DD'
}
```
> **불변 준수:** `CollectedChord {name,frets,key}` 변경 금지. `SheetSlot`은 collected/armedChord와 `{name,frets}` 부분 구조를 공유하되 `key`는 불필요(악보 슬롯은 표시·재생용). `Drill.seq`(기존 `DrillSeqItem{name,frets}`)와 **동일 shape** → `addDrillFromSheet`에서 `sheet.seq.filter(Boolean)`를 `DrillSeqItem[]`로 그대로 재사용 가능(타입 정합).

### 3.2 도메인 상수
```ts
export const BEATS: Record<TimeSig, number> = { '4/4': 4, '3/4': 3, '6/8': 6 };
```

### 3.3 순수 도메인 함수 (`src/domain/sheet.ts` — 신규, React 무의존, 테스트 1급)
```ts
export function beatsOf(ts: TimeSig): number;
export function padSlots(seq: SheetSequence, beats: number): SheetSequence;
export function placeAt(seq: SheetSequence, i: number, chord: SheetSlot | null): SheetSequence;
export function clearSlot(seq: SheetSequence, i: number): SheetSequence;
export function addMeasure(seq: SheetSequence, beats: number): SheetSequence;
export function removeMeasure(seq: SheetSequence, mi: number, beats: number): SheetSequence;
export function retime(seq: SheetSequence, newBeats: number): SheetSequence; // setTimeSig의 순수부(padSlots 위임)
export function sequenceToMeasures(seq: SheetSequence, beats: number): SheetSequence[]; // 렌더용 분할
export function usedChords(seq: SheetSequence): SheetSlot[]; // chordBox용 고유 코드(원본 used, 라인 624)
export function filledCount(seq: SheetSequence): number;
export function emptySequence(beats: number): SheetSequence; // beats*2 null
export function makeSheet(title: string, seq: SheetSequence, timeSig: TimeSig, date: string): Sheet;
```
> 원본 헬퍼(라인 458-467)의 **알고리즘을 수치 그대로 이식**. 순수/불변(입력 seq를 mutate 하지 않고 새 배열 반환).

### 3.4 영속화 계층 확장
`PersistedState`(persist.ts)에 슬라이스 추가:
```ts
export interface PersistedState {
  grass: GrassMap;
  journal: JournalEntry[];
  collected: CollectedChord[];
  drills: Drill[];
  sheets: Sheet[];   // ← 신규
  lang: 'ko' | 'en';
}
```
`KEYS`에 `sheets: 'cs_sheets'` 추가. `Repository` 인터페이스에 `listSheets()/setSheets()` 추가. `LocalRepository`에 read/write + seedOnEmpty 분기.

---

## 4. 컴포넌트 트리 & 모듈 경계

```txt
App (Shell)
└─ case 'builder' → <BuilderView>                         [views/BuilderView.tsx 신규]
   ├─ <SheetCard>                                          [components/builder/SheetCard.tsx]
   │  ├─ 제목 input · <Segmented> 박자표 · [비우기][저장]  (재생 버튼: disabled/후속)
   │  ├─ hint 배너 (armed 상태 문구)
   │  ├─ 제목/메타(N CHORDS)
   │  ├─ <UsedChordBox>  (usedChords → <ChordDiagram width=72>)  [components/builder/UsedChordBox.tsx]
   │  ├─ <MeasureGrid>   (sequenceToMeasures → <BeatCell> 격자)   [components/builder/MeasureGrid.tsx]
   │  │   └─ <BeatCell>  (onClick → place/clear/toast)
   │  └─ [+ 마디 추가]
   ├─ <ChordPalette>                                       [components/builder/ChordPalette.tsx]
   │   └─ collected.map → 다이어그램 카드(arm 토글, ×제거)
   └─ <SavedSheets>                                        [components/builder/SavedSheets.tsx]
       └─ sheets.map → 제목/메타 + [불러오기][삭제]
```

**경계 규칙(CLAUDE.md 준수):**
- BeatCell/MeasureGrid는 **계산 로직 직접 구현 금지** → `sequenceToMeasures`/`beatsOf` 등 domain 함수만 호출.
- 다이어그램은 기존 `<ChordDiagram frets width>` 재사용(신규 SVG 금지).
- 배치/저장/삭제/arm은 **모두 reducer action**(로컬 컴포넌트 state로 시퀀스 관리 금지 — 영속·동기화 경로 일관).
- 박자표 세그는 기존 `<Segmented>` 재사용(원본 seg 인라인 대신).

---

## 5. 상태 / reducer 확장 (순수 유지)

### 5.1 `AppState` 추가 필드 (appReducer.ts)
```ts
// 빌더 (persisted: sheets / 트랜션트: 나머지)
sheets: Sheet[];              // persisted
sequence: SheetSequence;      // 트랜션트(작업 중 악보)
armedChord: SheetSlot | null; // 트랜션트
timeSig: TimeSig;             // 트랜션트
sheetTitle: string;           // 트랜션트
```
`initState`: `sheets: persisted.sheets`, `sequence: emptySequence(beatsOf('4/4'))`(또는 시드 악보 로드 — §9 Q3), `armedChord: null`, `timeSig: '4/4'`, `sheetTitle: ''`.

### 5.2 신규 Action
```ts
| { type: 'ARM_CHORD'; chord: SheetSlot }
| { type: 'PLACE_AT'; index: number }        // armed 유무에 따라 place/clear/toast 분기
| { type: 'CLEAR_SLOT'; index: number }
| { type: 'ADD_MEASURE' }
| { type: 'REMOVE_MEASURE'; measureIndex: number }
| { type: 'SET_TIME_SIG'; timeSig: TimeSig }
| { type: 'SET_SHEET_TITLE'; title: string }
| { type: 'CLEAR_SEQUENCE' }
| { type: 'SAVE_SHEET' }
| { type: 'LOAD_SHEET'; id: string }
| { type: 'DELETE_SHEET'; id: string }
```
각 케이스는 §3.3 domain 함수에 위임하고 상태만 갱신 → reducer 순수 유지. `SAVE_SHEET`는 `makeSheet` + `dateStr(new Date())`(기존 패턴, `bumpToday`와 동일하게 reducer 내 `new Date()` 허용 — 기존 `ADD_JOURNAL`도 동일). `HYDRATE`에 `sheets: action.persisted.sheets` 한 줄 추가.

### 5.3 `HomeView` board의 `homeToBuilder` 버튼
`disabled` 제거 + `onClick={() => dispatch({ type:'SET_VIEW', view:'builder' })}`.

---

## 6. 영속화 키 & 동기화 영향 분석 (핵심)

### 6.1 로컬 영속 (PR-1)
- 키 `cs_sheets` 추가(prefix 규약: `u:{uid}:cs_sheets` 자동). `AppContext.persistedOf`에 `sheets` 포함, effect deps에 `state.sheets` 추가.
- **동기 경로(비로그인)**: `saveAll({sheets})`만으로 완결 → PR-1 단독으로 로컬 사용자 완전 동작.

### 6.2 동기화 파급 (PR-2에서만 처리 — 확장 비용 명시)
`sheets`를 서버 동기화하려면 다음이 **모두** 필요(§05 backend plan 패턴 따름):
| 파일 | 변경 |
|------|------|
| `state/repo-change.ts` | `RepoChange`에 `{kind:'sheet', op:'upsert', sheet, sortOrder}` / `{kind:'sheet', op:'delete', id}` 추가 |
| `state/diff-changes.ts` | sheets id-기준 upsert/delete diff (drills 블록 패턴 복제) |
| `state/apply-changes.ts` | `case 'sheet'` 멱등 적용 |
| `state/mappers.ts` | `SheetRow` 타입 + `sheetToRow`/`rowToSheet`(seq JSON, time_sig, entry date 매핑) |
| `state/supabase-repository.ts` | `TABLE.sheets` + pull select + upsert/delete 메서드 |
| `state/sync-repository.ts` | sheets 슬라이스 병합/캐시 반영 |
| `sync/merge.ts` | sheets LWW 병합(updated_at 기준) |
| **DB 마이그레이션** | `sheets` 테이블(user_id, id, title, seq jsonb, time_sig, sheet_date, sort_order, deleted_at, updated_at) + **RLS 정책**(user_id = auth.uid()) |
| `state/*.test.ts` 다수 | diff/apply/merge/mapper/repository 골든 테스트 |

**설계 권고:** `Drill.seq/sheetId/timeSig`가 이미 서버 스키마(`DrillRow.seq/sheet_id/time_sig`)에 존재하므로, **PR-2는 이 기존 패턴을 그대로 복제**하면 된다(선례 존재 → 리스크 낮음). 단 **DB 마이그레이션 + RLS는 사용자 확인 필요**(CLAUDE.md "When Unsure: 스키마 큰 변경").

### 6.3 로컬 전용에서 sheets가 새는 것 방지
PR-1에서 `PersistedState.sheets`를 추가하면 `diffChanges`/`applyChanges`가 sheets를 **모른 채** 통과해야 한다(sheets diff 미산출 = 서버로 안 감). 기존 함수는 슬라이스를 명시 나열하므로 자동으로 무시됨 → **회귀 없음**. 단 `SyncRepository`가 `PersistedState`를 통째로 캐시하면 로컬 캐시에는 sheets가 포함되어도 무방(서버 push만 안 하면 됨). PR-1 단계에서는 **비로그인/동기 경로만 sheets 저장**, 로그인 유저의 sheets는 PR-2까지 로컬 캐시에만 존재(명시적 한계 → §9 Q5).

---

## 7. 검증 경계면 (QA 교차검증 지점)

| # | 경계면 | 생산자 | 소비자 | 계약(shape) |
|---|--------|--------|--------|------------|
| B1 | 팔레트 → arm | `<ChordPalette>` onClick | reducer `ARM_CHORD` | `SheetSlot {name,frets}` (collected에서 파생) |
| B2 | armed → 배치 | reducer `armedChord` | `placeAt(seq,i,armed)` | `SheetSlot\|null` |
| B3 | 시퀀스 → 마디 격자 | `sequenceToMeasures` | `<MeasureGrid>/<BeatCell>` | `SheetSequence[]`, 각 마디 길이 = beats |
| B4 | 슬롯 → 다이어그램 | `usedChords`/slot.frets | `<ChordDiagram frets>` | `FretArray`(length 6) |
| B5 | 저장 → 영속 | reducer `SAVE_SHEET`→state.sheets | `Repository.setSheets`/`saveAll` | `Sheet[]` (`cs_sheets` JSON) |
| B6 | 악보 → 드릴 담기 | `sheet.seq.filter(Boolean)` | `Drill.seq` (`DrillSeqItem[]`) | shape 동일(`{name,frets}`) — **타입 정합 필수** |
| B7 | sheets → 서버(PR-2) | `diffChanges`→`RepoChange` | `SupabaseRepository`/`mappers` | `SheetRow`(snake_case, seq jsonb) |
| B8 | 서버 → 복원(PR-2) | `rowToSheet` | `applyChanges`/state | `Sheet` (id 자연키 멱등) |

---

## 8. PR 분할안 (권장)

### PR-1 · 로컬 전용 악보 빌더 (feat/sheet-builder-local)
범위: 뷰 활성화 + 도메인(`sheet.ts`) + reducer 액션 + 컴포넌트 + `cs_sheets` 로컬 영속 + 시드 악보 + 홈/사이드바 링크 활성.
- **동기화 코드 무변경.** 비로그인 사용자에게 완전 동작. 로그인 사용자는 로컬 캐시 저장(서버 미반영 — 명시 한계).
- 산출: `domain/sheet.ts`(+테스트), `views/BuilderView.tsx`, `components/builder/*`, reducer 확장, persist/repository/local-repository 확장, seed.
- 검증: AC-1~21, 26, 27.

### PR-2 · 악보 동기화 + 드릴 연동 (feat/sheet-builder-sync)
범위: §6.2 전체(RepoChange/diff/apply/mappers/supabase-repo/merge/sync-repo) + DB `sheets` 테이블·RLS 마이그레이션 + 연습 뷰 "내 악보 담기"(`addDrillFromSheet`) UI.
- **선행: 사용자 DB 스키마 승인**(§9 Q6).
- 검증: AC-22~25 + 드릴 연동.

> 분리 이유: PR-1은 UI/도메인 리스크만(리뷰 쉬움), PR-2는 DB/RLS/머지 리스크(별도 신중 리뷰). CLAUDE.md "작업단위로 PR 분리" 준수.

---

## 9. 열린 질문 (사용자 체크포인트)

- **Q1. 오디오 재생(▶)** — 원본 `strumSeq`는 Web Audio. request.md 후속이므로 이번엔 **버튼 비활성(disabled+"준비 중")**로 자리만 두는 것으로 계획. 동의?
- **Q2. 재생/비우기/저장 버튼 배치** — 원본은 sheet 카드 상단 우측 3버튼. 재생 제외 시 [비우기][저장]만 노출 vs 재생 disabled 노출. 어느 쪽?
- **Q3. 시드 악보** — 원본 `seedExampleSheet`는 **작업 중 sequence**를 예시로 채움(저장 전). 우리 모델에선 트랜션트라 새로고침 시 사라짐. 대안: (a) `sheets`에 예시 1개를 시드로 저장(AC-21) / (b) 시드 없이 빈 8칸 시작. 어느 쪽?
- **Q4. 배치 소스 = collected만?** 원본은 collected만 팔레트에 노출. 사전에서 바로 배치하는 경로는 없음(사전 "담기"→빌더 흐름). 이대로 유지?
- **Q5. 로그인 유저의 PR-1 sheets** — PR-1에서 로그인 유저가 만든 악보는 로컬 캐시에만 있고 서버 미동기(PR-2 전까지). 이 한계 수용? 아니면 PR-1을 비로그인에서만 빌더 노출로 제한?
- **Q6. DB 스키마/RLS (PR-2)** — `sheets` 테이블 신설 + RLS는 CLAUDE.md "When Unsure". PR-2 착수 전 스키마 초안 별도 승인 받는 것으로. 동의?
- **Q7. lyrics** — 원본 state에 `lyrics:{}` 있으나 빌더 UI 미사용. 완전 제외 확정?

---

## 10. 회귀 위험

- **R1 `PersistedState` 시그니처 변경** → `load/save`/`loadAll`/모든 Repository 구현/기존 테스트가 `sheets` 필드 부재로 타입 에러. → 모든 구현체·테스트 픽스처에 `sheets: []` 추가 필요(PR-1에서 일괄).
- **R2 reducer `default` exhaustive** → 신규 Action 미처리 시 `never` 컴파일 에러(안전장치 작동). 모든 케이스 구현 강제됨.
- **R3 effect deps** → `AppContext` persist effect에 `state.sheets` 누락 시 sheets 저장 안 됨. deps 배열 갱신 필수(AC-19 테스트로 포착).
- **R4 B6 타입 드리프트** → `SheetSlot`과 `DrillSeqItem`이 갈라지면 드릴 연동(PR-2) 깨짐. **동일 shape 유지**(둘 다 `{name, frets:FretArray}`) 불변으로 고정.
- **R5 sparse 배열 직렬화** → `JSON.stringify([{...},null])`는 null 보존되므로 안전. 단 `filter(Boolean)` 후 인덱스 이동 주의(place는 절대 인덱스 유지).
- **R6 홈 board 링크** → `homeToBuilder` 활성화 시 기존 HomeView 스냅샷 테스트가 `disabled` 부재로 실패 가능 → 테스트 갱신.

---

## 11. 단계별 빌드 순서 (PR-1, TDD)

1. `domain/types.ts` + `domain/constants`(BEATS): `TimeSig/SheetSlot/SheetSequence/Sheet` 추가.
2. `domain/sheet.ts` + `__tests__/sheet.test.ts`: §3.3 함수 골든 테스트 먼저(원본 수치 이식) → 구현.
3. `persist.ts`/`repository.ts`/`local-repository.ts`: `sheets`/`cs_sheets`/`listSheets`/`setSheets` + seed. 테스트 픽스처 `sheets:[]` 일괄.
4. `state/seed.ts`: `seedSheets()`(Q3 결정 시).
5. `appReducer.ts` + `__tests__`: `AppState` 필드 + 11개 Action + `initState`/`HYDRATE`. reducer 순수 테스트.
6. `AppContext.tsx`: `persistedOf`에 sheets, effect deps 추가.
7. `components/builder/*` + `views/BuilderView.tsx` (+ CSS Modules, 디자인 토큰 재현). 컴포넌트 렌더 테스트.
8. `App.tsx` case 'builder', `Sidebar` `disabled:false`, `HomeView` homeToBuilder 활성. 스냅샷 갱신.
9. `npm run build` && `npm test`.

> PR-2 순서는 §6.2 표를 그대로 따르되, **DB 스키마 승인(Q6) 후** 착수.
