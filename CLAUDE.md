# CLAUDE.md

이 파일은 **항상 컨텍스트에 로드**된다. 그래서 참조 + 절대 규칙만 담는다.
상세 내용은 아래 문서를 **필요할 때만** 읽는다(lazy load).

## Project

`guitar-chordex` / **코드살롱 (Chordex)** — 기타 코드/스케일 사전, 코드 다이어그램(운지)·보이싱,
연습 기록(잔디 히트맵·드릴 체크리스트·연습 일지)을 제공하는 기타 연습 웹앱.
**웹 + iOS/Android(Capacitor) 출시**를 목표로 한다. 현재 MVP(웹) 완료, 모바일 래핑·백엔드 단계 진입.

## Source of Truth (필요 시 읽기)

작업 전 관련 문서를 읽고 판단한다. 문서와 충돌하는 구현을 하지 않는다.
문서에 없는 큰 결정이 필요하면 먼저 사용자에게 확인한다(→ `When Unsure`).

- `_workspace/00_input/request.md` — 요구·MVP 범위·수용 기준·디자인 토큰 (요구 정본)
- `_workspace/00_input/design/기타 코드 연습 Figma.dc.html` — **디자인 정본(SoT). 시각 결과를 재현**
- `_workspace/01_architect_plan.md` — MVP 설계: 데이터 모델·도메인 함수·컴포넌트·상태·빌드 순서·검증 경계면 (**구조 정본**)
- `_workspace/02_implementer_log.md` — 구현 로그(파일 맵·결정)
- `_workspace/03_qa_report.md` — QA 리포트(경계면 검증·도메인 정확성)
- `_workspace/05_backend_auth_plan.md` — 백엔드(Supabase)+인증+동기화 설계, **작업단위 PR 분해**
- 하네스: `.claude/skills/chordex-feature-dev` (아래 `하네스` 절)

## Core Product Flow

```txt
루트/키 선택 → 코드 사전(키별 다이어토닉 / 루트별) · 스케일(지판) 조회
→ 코드 다이어그램(SVG: 뮤트/오픈/프렛/운지) · "모든 폼"(보이싱 생성)
→ 연습 기록(드릴 체크 → 잔디+1 · 잔디 히트맵 · 연습 일지) → localStorage 영속
→ (후속) Supabase 계정 로그인 → 기기간 동기화/백업
```

MVP 최우선 3가지: ① **정확한 코드/보이싱 생성**(음악적 타당성) ② 코드 사전·스케일 조회 ③ 연습 기록(잔디/드릴/일지).
후순위(후속 PR): 악보 빌더 · 레슨 기록 · 오디오 재생 · 클립보드 복사 · i18n(EN) · 백엔드/인증/동기화.

## Stack & Commands

Vite 5 (React 플러그인) · React 18 · TypeScript strict · **CSS Modules**(+ `tokens.css` 디자인 토큰) · Vitest 2 · Capacitor 8 · npm.
- 검증: `npm run build` (tsc -b → vite build), `npm test` (vitest run). 타입만: `npx tsc -b`.
- 개발 서버: `npm run dev` (포트 **5173**). 프리뷰는 `.claude/launch.json`의 `vite-dev` 사용.
- 도메인 로직은 `src/domain/`(순수 함수, React 무의존, **테스트 1급 대상**). 컴포넌트는 `src/components/`, 페이지는 `src/views/`, 상태는 `src/state/`.
- 모바일: `capacitor.config.ts`(appId `com.chordsalon.app`, webDir `dist`). 네이티브 초기화는 `src/native.ts`(웹에서는 no-op). iOS 빌드는 **Mac 필요**.
- TDD: 순수 도메인 로직은 테스트 먼저(골든 케이스). 원본 알고리즘/기하/상수는 **수치 그대로 이식**.

## Domain Invariants (불변값 — 변경 시 사용자 확인)

```ts
type Quality = 'maj' | 'min' | '7' | 'maj7' | 'm7' | ...; // 58종, SUF/INTERVALS 키와 1:1
type Fret = number | 'x';   // 'x'=뮤트, 0=개방현, 양수=프렛. frets 배열은 항상 length 6
type ScaleType = 'major' | 'minor' | 'majpent' | 'minpent' | 'blues';
type KeyType = 'major' | 'minor';
```

- `frets`는 6현 배열, 인덱스 **0=6번줄(저음 E) … 5=1번줄(고음 e)**.
- 보이싱 생성(`bestVoicing`/`allVoicings`)·다이어그램 기하(`computeDiagram`/SVG 상수)·스코어링은 디자인 정본과 **1:1** — 음악 정확성이 핵심, 임의 변경 금지.
- `buildChord` 우선순위(엄수): OPEN(오픈코드) → `m7b5` 특수 → BARRE_OK 바레 → `bestVoicing` 폴백. 변경 시 골든 테스트 갱신.
- localStorage 키: `cs_grass` / `cs_journal` / `cs_drills` / `cs_collected` / `cs_lang`.
- 전체 데이터 모델은 `_workspace/01_architect_plan.md` §3 참조(정본).

## CRITICAL Rules

**계층 / 관심사 분리** (상세: 01_architect_plan §2·§5)
- 도메인 로직은 `src/domain/`(순수). **UI(`components`/`views`)에서 코드/보이싱/스케일/기하 계산을 직접 구현 금지** — domain 함수 호출.
- 상태는 `src/state/`(reducer는 순수 유지 + Context + persist). 영속화는 persist 계층 경유(키는 `cs_*`).
- 인라인 스타일 프로토타입을 그대로 복사하지 않는다 — **시각 결과를 재현**하되 CSS Modules로. 색은 `tokens.css` 한 곳에서.

**백엔드 / 보안** (후속, 상세: 05_backend_auth_plan §3·§10)
- Supabase `anon` key 외 `service_role` key는 클라이언트/깃에 **절대 금지**. `.env*`는 커밋하지 않는다(`.env.example`만).
- **RLS가 데이터 격리의 유일 방어선** — 모든 테이블 RLS 필수.

**Git / PR** (사용자 규칙)
- `main`에 직접 commit/push **금지**(최초 베이스라인 부트스트랩 1회 제외). 작업은 `feat|fix|docs|refactor|test|chore/{slug}` 브랜치에서.
- **Conventional Commits**(`type(scope): summary`). **사용자 승인 전 merge 금지.**
- **작업단위로 PR 분리** — 여러 작업/무관한 리팩토링을 한 PR에 묶지 않는다.
- 커밋 전 `git rev-parse --abbrev-ref HEAD`로 브랜치 확인(세션 혼선 방지). `gh`는 인증됨(account kiki-sati).

## Do Not

- main 직접 push / 사용자 승인 없이 merge
- 도메인 보이싱·다이어그램 기하 수치를 음악 검증 없이 변경
- UI 컴포넌트에서 코드/스케일/보이싱/기하 로직 직접 구현
- `service_role` key·`.env` 커밋 / anon 외 시크릿 클라이언트 노출
- 전체 기능을 한 번에 구현 / 관련 없는 리팩토링을 같은 PR에 포함
- 문서(`_workspace/*`)·디자인 정본과 충돌하는 구조 변경 / 테스트 실패 무시하고 PR 생성
- MVP 범위 임의 확대 (악보/레슨/오디오/복사/i18n/백엔드는 계획된 후속 PR로)

## When Unsure (임의 결정 금지 — 사용자 확인)

백엔드/DB 도입·스키마 큰 변경 · 인증 방식 변경 · 도메인 불변값(Quality/Fret/보이싱 알고리즘) 변경 ·
디자인 방향 변경 · 대규모 리팩토링 · MVP 범위 확대 · 유료/계정 기능 추가 · 새 런타임 의존성 추가.

## 하네스: 기능 개발

**트리거:** 기능 개발·구현·수정·재구현·QA 재검증 등 guitar-chordex 기능 작업 요청 시 `chordex-feature-dev` 스킬을 사용한다. 단순 질문은 직접 응답.
**팀:** architect → implementer → qa-verifier. 모든 산출물은 `_workspace/`에 md로 관리(하네스 엔지니어링).

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-22 | 초기 구성 (architect/implementer/qa-verifier 팀 + 4개 스킬) | 전체 | - |
| 2026-06-24 | 실제 프로젝트 컨텍스트 반영(스택·구조·도메인 불변값·Git/PR·백엔드 계획), 레퍼런스 구조 적용 | CLAUDE.md | MVP 구현 완료 + 모바일/백엔드 단계 진입 |
