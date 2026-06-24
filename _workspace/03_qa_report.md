# QA 리포트 — 코드살롱 (guitar-chordex) MVP

> 검증: qa-verifier · 2026-06-24 · 방법: integration-qa 스킬(경계면 양쪽 동시 읽기 + 명령 독립 재실행 + 원본 HTML 라인 교차 대조)
> 입력: `01_architect_plan.md`(§11 경계면 10개) · `02_implementer_log.md` · `request.md` · 도메인 SoT(`기타 코드 연습 Figma.dc.html`)
> 환경: node v24.14.0 / npm 11.9.0 / Windows 11 PowerShell. node_modules 존재.

## 종합 판정: **PASS (출시 가능)**

10개 검증 경계면 전부 정합, 도메인 수치/로직이 원본과 1:1(추가 472건 독립 교차검증 통과), 스펙 4뷰/disabled 슬롯 전부 준수. 빌드·테스트·타입체크 3종 명령 모두 독립 재실행으로 통과 확인. **차단(blocking) 이슈 0건.** 비차단 경미 관찰 3건만 기록(아래 "관찰/권고").

---

## 명령 독립 재실행 결과 (가정 아님, 실제 실행 출력)

| 명령 | 결과 | 근거 |
|------|------|------|
| `npx vitest run` | **108 passed (15 files), 실패 0** | "Test Files 15 passed / Tests 108 passed" |
| `npx tsc -b --force` (strict) | **통과 (TSC_EXIT=0)** | 출력 빈 에러 + exit 0 |
| `npm run build` (tsc -b + vite build) | **통과 (BUILD_EXIT=0)** | "80 modules transformed", JS 188.77 kB / CSS 20.82 kB, "built in 1.41s" |
| `npx vitest run`(QA 추가 교차검증, 임시) | **472 passed** | 포팅 보이싱 엔진 == 원본 전사본 (아래 도메인 정확성) |

implementer 자가 검증 수치(108 tests / 80 modules / BUILD_EXIT=0)와 **완전 일치 — 재현 확인됨.**

---

## 통과 — 검증 경계면 (계획 §11, 생산자→소비자 양쪽 대조)

- **경계면 1 (코드→다이어그램)**: `buildChord().frets`(Fret[] len 6) → `ChordDiagram`/`computeDiagram`. ChordDiagram.tsx의 기하 상수(VB104/VH136, ML 20|22, gap (VB-38|40)/5, r 6.4|7.6, nutY30/bottom126/markerY14, 너트 굵기 3|1.3, tones 음이름 OPENPC 기반)가 원본 diagramEl(라인 402-413)·diagramTone(349-360)과 1:1. `computeDiagram` start/showNut/dots/markers 정확.
- **경계면 2 (다이어토닉/루트/검색→그리드)**: `diatonic`/`buildChord`/검색필터 → `DictionaryView`/`ChordCard`. 검색은 `normalizeQuery(noteName(r)+SUF[ql])`로 정규화 후 `includes` 매칭(12루트×QUALS) — 원본 chordGrid(라인 560)과 동일. roman은 ChordCard에서 정상 표시.
- **경계면 3 (스케일→지판)**: `scaleNotes(root,type)` → `Fretboard`. 루트 강조 `pc===root%12`로 accent 채움, OPEN_MIDI로 pc 산정, f0 너트 좌측 cx=fx(0)-13, 프렛마커 [3,5,7,9,12] — 원본 fretboardEl(581-589)과 1:1.
- **경계면 4 (잔디→히트맵)**: `buildGrass`/`level` → `GrassHeatmap`. ~53주 구조(테스트로 53≤len≤54 검증), level 0-4 → `GLEVELS[level]`, null→transparent. 원본 grassEl/legendEl(533-537)과 동일.
- **경계면 5 (드릴 카운트→잔디)**: `SET_DRILL_COUNT` reducer(appReducer.ts:216-237) 전이 가드 `after.count>=after.target && before.count<before.target` → 원본(라인 475)과 동일. 전이 순간에만 grass+1+토스트(중복 없음). DrillList 스탬프 클릭 `onSetCount(id, i+1===count?i:i+1)`(DrillList.tsx:91) = 원본 라인 485 일치.
- **경계면 6 (일지 제출→상태)**: `ADD_JOURNAL` reducer(appReducer.ts:173-198) — 빈 제목 시 토스트, 성공 시 `[entry, ...journal]` prepend + grass+1 + draft 4필드 리셋 + 토스트. 계약 충족.
- **경계면 7 (영속화)**: Provider persist(AppContext.tsx:26-44) → 영속 슬라이스(grass/journal/drills/collected/lang)만 save, 첫 마운트 skip. persist.ts load/save try/catch + 시드 폴백(`??`). round-trip 일관. **JSON 직렬화 안전**: 영속 슬라이스에 Date 없음(GrassMap=string→number, JournalEntry 날짜는 문자열). buildGrass의 `date:Date`는 파생값(저장 안 함).
- **경계면 8 (모든 폼)**: `allVoicings(root,q)` → `ChordDetailModal`. 정렬(pos→score)·≤10폼·OPEN/Nfr 라벨(`computeDiagram(fr).showNut`)·구성음 태그(`INTERVALS[qualKey].map`) 전부 원본 detailView(361-382)와 일치.
- **경계면 9 (상수 무결성)**: `INTERVALS`/`SUF`가 `Record<Quality, …>`로 타이핑 → 58개 Quality 전수 커버를 컴파일 타임 강제. tsc 통과가 곧 누락 0 증명. NOTE/QUALS/OPEN/scaleDefs/GLEVELS/BARRE_OK/QGROUPS/OPENPC/OPEN_MIDI 전부 원본 라인 172-197과 1:1 대조 완료.
- **경계면 10 (통계)**: `stats(grass)` → StatCard/Sidebar/Header/Home. streak(오늘 미기록 시 어제부터 `continue`), week(7일 합), days/total. 원본 라인 525-529와 동일. 소비처 4곳 모두 동일 함수 사용.

## 통과 — 도메인 정확성 (원본 HTML 라인 1:1 대조 + 독립 교차검증)

- **buildChord 우선순위**(chord.ts:34-49): ①OPEN→②m7b5 특수 `n=((ni-9)+12)%12; ['x',n,n+1,n,n+1,'x']`→③BARRE_OK→④bestVoicing. 원본 라인 294-302와 문자 단위 일치.
- **barre E/A shape 선택**(chord.ts:52-68): eBase/aBase 산정 및 분기(`eBase===0` / `aBase>0 && aBase<eBase`), E/A shape 테이블 — 원본 303-311과 일치. 골든: F=E-shape[1,3,3,2,1,1], B♭=A-shape['x',1,3,3,3,1], B=A-shape['x',2,4,4,4,2] 확인.
- **requiredPCs drop 7→2→5, 최대 4음**(chord.ts:81-93) = 원본 라인 314. maj9에서 완전5도(7) 우선 제거 검증.
- **_collect 스코어링**(voicing.ts:67-112): 비뮤트<4 reject, 연속성 reject, 운지폭>4 reject, req 누락 reject, `bassPc!==rootPc → +4`, `+(6-cnt)`, `mx>0 → +(mx-mn)*0.3` — 부동소수 포함 원본 라인 322-333과 1:1. base-loop 조기 break(낮은 포지션 우선) 유지.
- **computeDiagram start**(diagram.ts:14-32): `mx>5`일 때만 `start=max(1,mn)`, 아니면 1. showNut=start===1. dots row=f-start+1. 원본 393-401 일치.
- **diatonic quals·romans**(diatonic.ts): majQ/majR/minQ/minR + Object.assign(roman,key='d'+i). C major(Cmaj7…Bm7♭5/Imaj7…viiø), A minor(i m7…♭VII7) 골든 일치. Bm7♭5가 m7b5 특수식 경유 확인(['x',2,3,2,3,'x']).
- **stats/level/buildGrass/seedGrass**: 원본 525-532 / 263-268 일치(해시 `(i*2654435761)%97`, 최근 7일 `[2,2,1,3,1,2,1]`).
- **독립 교차검증(강한 증거)**: 원본 HTML의 `_enumBase`/`_collect`/`bestVoicing`/`allVoicings`/`requiredPCs`를 별도 전사하여 **13개 퀄리티 × 12 루트 = 472건**에 대해 포팅 결과와 `toEqual`(정확한 frets 배열) 비교 → **전부 일치**. 부동소수 스코어링·byPos 정렬·drop 순서까지 동일함을 byte-level로 입증. (교차검증 테스트는 임시 파일이었으며 검증 후 삭제함 — 산출물에 미포함.)

## 통과 — 스펙 준수 (request.md / 계획 §1)

- **MVP 4뷰**(home/dictionary/scales/practice) App.tsx switch 라우팅. builder/lesson은 HomeView 안전 폴백(네비 disabled로 도달 불가).
- **builder/lesson 네비 disabled**: Sidebar NAV_DEFS 6항목, builder(idx3)/lesson(idx5) `disabled:true`+흐림+`title=준비 중`, 클릭 가드. navDefs 순서(home/dictionary/scales/builder/practice/lesson)가 원본 라인 798-803과 동일.
- **재생/복사 버튼 disabled 슬롯**: ChordCard(play/copy `disabled`, collect/all-forms 활성), ChordDetailModal(▶/⧉ disabled, ♥ 활성), HomeView 추천코드 듣기 disabled. onPlay/onCopy 주석 슬롯 예약.
- **KO 고정**: 전 UI 문자열이 `i18n/strings.ts`(ko/headerTitles/scaleLabelKo) 경유, 하드코딩 없음. lang 슬롯·cs_lang 유지(EN 후속).
- **도메인/UI 분리**: `src/domain/`(React 무의존 순수함수) ↔ `src/components/`+`src/views/` 디렉터리 분리 확인.
- **도메인 단위 테스트**: 54개 도메인 + 21개 상태 + 컴포넌트/뷰 테스트로 커버.

## 통과 — 기타 코드 도메인 무결성 (음악 이론 체크)

- 모든 보이싱 6현 배열(length===6 테스트 보장). 프렛값 유효(0=개방, 'x'=뮤트, 양수, 음수 없음).
- 필수 구성음 포함·운지폭≤4·연속(중간 뮤트 없음)·비뮤트≥4현 — voicing.test 불변식 + 472건 교차검증.
- 코드명(root+SUF)과 INTERVALS 구성음 무모순. 현 순서(6번줄 idx0 ↔ 1번줄 idx5) OPEN_MIDI/OPENPC 일관 적용(좌우 반전 없음).

---

## 실패 (Blocking)

**없음.** 차단 이슈 0건.

---

## 관찰 / 권고 (비차단 — 수정 선택사항)

1. **`normalizeQuery` 글로벌 치환 차이** — `src/domain/notes.ts:22`
   구현: `.replace(/♭/g,'b').replace(/♯/g,'#')`(전역) vs 원본(라인 560): `.replace('♭','b').replace('♯','#')`(첫 1회만).
   영향: 코드명/검색어에 ♭·♯가 1개뿐이라 **실사용 동작 동일**. 오히려 다중 기호 입력에 더 견고함. 회귀 아님. 정합성 강박이면 원본과 일치시킬 수 있으나 권장하지 않음(현행이 더 안전).

2. **`cs_lang` 저장 포맷 차이** — `src/state/persist.ts:43,59`
   구현: lang을 `JSON.parse`/`JSON.stringify`로 read/write(예: 저장값 `"ko"` 따옴표 포함) vs 원본(라인 222,286): raw 문자열 read/write(`ko`).
   영향: **앱 내부 round-trip 일관**(boundary 7 충족). 원본이 쓴 localStorage를 그대로 읽는 마이그레이션 시에만 불일치. MVP는 lang 고정 'ko' + 파싱 실패 시 'ko' 폴백이라 **사용자 영향 없음**. EN 토글 활성화(후속) 전 정렬 권고.

3. **스케일 칩 degree 라벨은 위치 기반** — `src/views/ScalesView.tsx:49`
   `R, 2, 3, …`을 음정이 아닌 배열 인덱스(`i+1`)로 표기. **원본 동일 동작**(원본도 위치 기반). 펜타토닉/블루스에서 음정상 정확한 도수와 다를 수 있으나 디자인 의도 보존 — 회귀 아님. 정보용 기록.

---

## 미검증 (실행/환경 제약)

- **반응형 @media(820/600/440)**: jsdom 자동 테스트 불가. global.css에 원본 규칙 이식됨(정적 확인 완료). 실제 뷰포트 렌더 동작은 **수동/브라우저 검증 필요** — 본 QA 범위 밖.
- **폰트(Inter/JetBrains Mono/D2Coding) CDN 로드**: 오프라인/CSP 환경 폴백(system-ui/monospace) 동작은 런타임 환경 의존, 정적 미검증.
- **이모지(.ae 클래스)**: OS 이모지 폰트 의존, 시각 검증 미수행.

---

## implementer 전달 사항

차단 이슈 없음 — 재작업 불필요. 관찰 1·3은 원본 의도 보존이므로 조치 불요. 관찰 2(`cs_lang` JSON 포맷)는 EN 토글 후속 작업 착수 시점에 정렬 권고(현 MVP 영향 없음).
