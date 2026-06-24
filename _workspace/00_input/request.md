# 기능 요구: 코드살롱 — 기타 코드 연습 (Figma 디자인 기반)

> **갱신 (2026-06-24):** 최초 request.md는 Figma 파일 미열람 상태의 MVP 추정이었음(→ `request_initial_guess.md`로 백업).
> 이제 실제 디자인 핸드오프를 입수·정독 완료하여 본 문서로 대체함.

## 출처 (Source of Truth)
실제 Claude Design 핸드오프 번들:
- **주 디자인 파일:** `C:/Users/plgrim/Downloads/chordex_handoff/remix/project/기타 코드 연습 Figma.dc.html`
  (847줄, React.createElement + DCLogic 프레임워크 프로토타입. **반드시 전체 정독**)
- **디자인 스펙 노트:** `C:/Users/plgrim/Downloads/chordex_handoff/remix/project/uploads/DESIGN-figma.md`
- **핸드오프 안내:** `C:/Users/plgrim/Downloads/chordex_handoff/remix/README.md`
  (핵심 지침: 프로토타입의 내부 구조가 아니라 **시각적 결과를 픽셀에 가깝게 재현**. 대상 코드베이스에
   맞는 기술로 재구현할 것.)

앱 이름: **코드살롱** (🎸). 라이트 테마, 미니멀/타이포그래피 중심.

## 환경 / 스택 (확정)
- **Vite + React + TypeScript + Vitest** (사용자 확정)
- 스타일: **CSS Modules**, 디자인 토큰 분리. 추가 런타임 의존성 최소화 (Tailwind 미사용)
- **도메인 로직은 UI와 분리** + 단위 테스트 (Vitest)
- 작업 루트: `C:/Users/plgrim/kiki/study_workspace/guitar-chordex/` (Vite 표준 레이아웃)
  - `guitar-chordex-/.git`(빈 하위 폴더)는 **무시**
- 백엔드 없음. 모든 데이터는 클라이언트 정적 + **localStorage** 영속화

## 구현 범위 (사용자 확정: 핵심 MVP 우선)

### ✅ MVP (이번 빌드)
1. **앱 셸 / 네비게이션**
   - 좌측 사이드바(브랜드 🎸 코드살롱, 네비, 주간 카운트 푸터) + 메인 헤더(eyebrow/타이틀, 스트릭 칩, "오늘 연습 기록" 버튼)
   - 반응형: 820px↓ 사이드바 가로 전환, 600px↓ 패딩 축소 (디자인의 @media 규칙 참조)
   - 네비 항목 중 MVP 대상: **홈 · 코드 사전 · 스케일 · 연습 기록** (악보/레슨은 후속이지만 네비 자리는 비활성/숨김 중 택1 — architect 판단)
2. **코드 사전 (Dictionary)** — 핵심
   - 모드 토글: **키별(다이어토닉)** / **루트별**
   - 키별: 선택 루트+major/minor → 다이어토닉 7코드 (로마숫자 표기). "전체 듣기"는 오디오 후속이므로 MVP에선 버튼 생략 또는 비활성
   - 루트별: QGROUPS(트라이어드/세븐스/식스/나인스/일레븐스/써틴스/서스펜디드)별 코드 그리드
   - 루트 선택 12음 pill, 코드 검색(입력 → 이름 매칭)
   - **코드 카드**: 로마숫자(있으면)+코드명 + 다이어그램 + 액션(담기/모든 폼). 재생/복사 버튼은 오디오·캔버스 후속 → MVP에선 담기/모든폼만, 혹은 비활성 처리(architect 판단)
   - **"모든 폼" 상세 모달**: allVoicings로 여러 보이싱 다이어그램 그리드 + 구성음 태그
3. **코드 다이어그램 렌더링 (SVG)** — 도메인 핵심
   - 6현 지판, 프렛 라인, 너트(1프렛 시작 시 굵게), 뮤트(×)/오픈(○) 마커, 운지 점, 시작 프렛 번호
   - 디자인의 `computeDiagram` / `diagramEl` / `diagramTone` 기하 로직을 충실히 이식
4. **스케일 (Scales)**
   - 스케일 탭(메이저/마이너/메이저펜타/마이너펜타/블루스), 루트 선택
   - 지판 전체(12프렛) 스케일 구성음 시각화(루트 강조), 구성음 칩, 범례
5. **연습 기록 (Practice)** — "잔디"
   - 통계 카드(연속/총일수/이번주/누적)
   - **드릴 체크리스트**(목표 횟수 동그라미 채우기, 목표±, 추가/삭제, 체크 비우기; 목표 달성 시 잔디+1)
   - **연습 잔디**(GitHub식 1년 히트맵) + 범례 + "오늘 연습 기록"
   - **연습 일지**(작성 폼 + 카드 리스트; 작성 시 잔디+1)
   - 시드 데이터(잔디/일지/드릴) — 첫 방문 시 예시 채움
6. **홈 (Home)**
   - 레이아웃 토글 최소 1종(포커스) 필수, 가능하면 board/minimal 포함
   - 스트릭 카드 + 잔디 카드 + 오늘의 추천 코드(다이어그램)
7. **도메인 엔진** (UI 무관, 테스트 대상)
   - NOTE/SUF/INTERVALS/QUALS/QGROUPS/OPEN(오픈코드)/BARRE/scaleDefs 상수
   - `buildChord`, `barre`, `bestVoicing`, `allVoicings`(보이싱 생성기), `diatonic`, `scaleNotes`, `computeDiagram`, `stats`/`buildGrass`/`level`
   - localStorage load/save (cs_grass, cs_journal, cs_collected, cs_drills 등 키 유지)

### ⏭ 후속 단계 (이번 빌드 제외)
- **악보 만들기(Sheet Builder)** — 마디 편성/저장/불러오기/armed chord 배치
- **레슨 기록(Lessons)** — 레슨 카드 + 숙제→드릴 연동
- **오디오 재생** — Web Audio pluck/strum (재생 버튼들)
- **클립보드 복사** — canvas → PNG (복사 버튼)
- **i18n** — 우선 **한국어** 단일. EN 토글은 후속 (단, 문자열은 추후 분리 쉽게 구조화 권장)

> 후속 기능들도 데이터 모델/컴포넌트 경계는 확장 가능하게 설계할 것(예: collected/sequence 상태 자리 확보, 액션 버튼 슬롯).

## 디자인 토큰 (소스에서 추출)
- 색: ink `#000`, muted `#5b5b57`, faint `#9a9893`, border `#e6e6e6`, line `#f1f1f1`, panel `#f7f7f5`
  - accent 기본 `#0052cc`(soft = accent+`14` 알파). 잔디 GLEVELS `['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39']`
  - 홈 포커스 스트릭 카드 배경 `#e8f2d2`, 레슨 강조 등은 후속
- 폰트: 본문 Inter + D2Coding 폴백 / 모노 'JetBrains Mono','D2Coding' / 이모지 클래스 `.ae`
- 라운딩: 카드 16, 칩/세그 50(pill), 작은 요소 6~9. 보더 1px `#e6e6e6`
- 코드 카드 폭: sm 92 / md 108 / lg 128 (`cardSize` prop, 기본 md)

## 수용 기준 (Acceptance Criteria)
- [ ] 사이드바/헤더 셸이 디자인 비주얼과 일치하고 4개 뷰 전환이 동작한다
- [ ] 코드 사전: 키별/루트별 전환, 루트 12음 선택, 검색이 동작한다
- [ ] 선택/검색된 코드가 정확한 운지 SVG 다이어그램으로 표시된다 (뮤트/오픈/프렛번호 포함)
- [ ] "모든 폼" 모달이 여러 보이싱을 표시한다
- [ ] 스케일 뷰가 지판 위 스케일 구성음을 루트 강조와 함께 표시한다
- [ ] 연습 기록: 드릴 체크/목표, 잔디 히트맵, 일지 작성이 동작하고 localStorage에 영속화된다
- [ ] 도메인 로직(코드/보이싱/다이어그램 기하/스케일/통계)이 모듈로 분리되고 **Vitest 단위 테스트로 검증**된다
- [ ] `npm run build`와 `npm test`(vitest run)가 통과한다
- [ ] 컴포넌트(뷰/위젯)와 도메인 로직이 분리되어 있다

## 도메인 정확성 주의 (QA 중점)
- `buildChord`: OPEN 우선 → m7b5 특수 → BARRE_OK 바레 → bestVoicing 폴백 순서 유지
- `bestVoicing`/`allVoicings`: requiredPCs(필수 구성음 4개 제한, drop 7→2→5) / _enumBase / _collect 스코어링(베이스가 루트 아니면 +4 등) 충실 이식 — 결과 운지가 음악적으로 타당해야 함
- `diatonic`: major/minor별 quals·romans 매핑(Imaj7…viiø / i m7…♭VII7)
- `computeDiagram`: start 프렛(최대 프렛>5면 최소 프렛 기준), showNut(start===1), dots/markers 분류

## 출력 산출물
- `_workspace/01_architect_plan.md` (architect)
- 소스 코드(`src/…`) + `_workspace/02_implementer_log.md` (implementer)
- `_workspace/03_qa_report.md` (qa-verifier)
