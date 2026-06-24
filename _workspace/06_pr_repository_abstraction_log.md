# PR③ Implementation Log — `feat/repository-abstraction`

> 산출물: 영속화 추상화 (`Repository` 인터페이스 + `LocalRepository` 구현).
> 대상 PR: `feat/repository-abstraction` (base: `main` @ `bbd59c0`).
> 설계 정본: `_workspace/05_backend_auth_plan.md` §4–§5 (백엔드/인증/동기화 플랜의 "영속화 추상화" 항목).
> 작업자: implementer (TDD 사이클).

---

## 1. 변경 파일

### 신규
| 파일 | 역할 |
|------|------|
| `src/state/repository.ts` | `Repository` 인터페이스 + `Lang` 타입 |
| `src/state/local-repository.ts` | `LocalRepository` 클래스 (localStorage 구현, React 무의존) |
| `src/state/__tests__/local-repository.test.ts` | 13개 단위 테스트 |

### 수정
| 파일 | 변경 요약 |
|------|----------|
| `src/state/persist.ts` | `KEYS` / `PersistedState` export 보존. `load()` / `save()` 는 `LocalRepository` 에 위임하는 `@deprecated` 호환층으로 축소 |
| `src/state/AppContext.tsx` | `load`/`save` 직접 호출 제거. `LocalRepository` 인스턴스 (기본) 또는 주입된 `Repository` 사용. `AppProviderProps.repository?: Repository` 신설 |

### 도메인 코드 / 디자인 변경 없음
`src/domain/**`, `src/state/appReducer.ts`, `src/state/seed.ts`, CSS modules, 시각 컴포넌트 모두 무수정. 도메인 불변값(보이싱·다이어그램 기하·스코어링·상수) 보존.

---

## 2. 설계 결정 (구현자 판단 + 근거)

### 2.1 인터페이스 형태: `loadAll`/`saveAll` (거시) + 엔티티별 fine-grained 메서드 동거
사용자 지시는 "현 persist 키와 reducer 액션의 IO 면을 커버하는 메서드"였고, 설계 정본 §5.2 는 거시 `Repository.load() / apply(changes)` 모델을 제안했다.

PR③ 범위(영속화 추상화만, 동작 불변)에서는:
- `loadAll()`/`saveAll(Partial<PersistedState>)` 가 현 AppContext 의 useEffect-save 패턴을 1:1 로 대체하는 최소 변경 경로.
- fine-grained API (`getGrass`/`setGrass`, `listJournal`/`setJournal`, …) 는 후속 PR 에서 reducer 액션 디스패치를 효율적인 단일 키 upsert 로 매핑하기 위한 사전 정비.
- `RepoChange` / `apply(changes)` 같은 동기화-친화 거시 API 는 본 PR 비-범위 (PR⑤ SyncRepo). `actionToChanges` 도 마찬가지로 PR⑤.

이렇게 두 단계로 나누면 본 PR 의 정합성 비용이 작고 (108 기존 테스트가 동작 가드), 다음 PR 에서 fine-grained 메서드 위에 SyncRepo 큐·디바운스를 쌓기 쉬워진다.

### 2.2 `persist.ts` 처리: 호환층 유지
삭제도 가능했으나 `KEYS` 가 다음 3개 테스트에서 import 되고 있어 호환층으로 보존:
- `src/state/__tests__/persist.test.ts` — `load`, `save`, `KEYS` 모두 사용
- `src/views/__tests__/PracticeView.test.tsx` — `KEYS` 사용 (localStorage 직접 검증)
- `src/App.smoke.test.tsx` — `KEYS` 사용 (헤더 로그 버튼 영속화 검증)

`load`/`save` 본문은 `LocalRepository` 에 위임. 마이그레이션 경로:
1. 신규 코드: `Repository` 인터페이스 사용
2. 후속 PR 에서 기존 테스트들이 Repository 기준으로 자연 전환되면 호환층 제거 검토.

`PersistedState` / `KEYS` 는 `Repository` / `LocalRepository` 도 import 하므로 도메인-인접 상수로 자리매김 — `repository.ts` 가 `PersistedState` 타입을 재사용한다.

### 2.3 `AppContext` 의 비파괴적 리팩터
- `AppProviderProps.repository?: Repository` 옵션을 추가하되 미지정 시 `LocalRepository` 인스턴스를 `useMemo` 로 생성. 기존 `<AppProvider>` 사용처 (테스트 헬퍼 포함) 는 무변경 — Optional prop.
- 클래스 인스턴스를 `useMemo` 로 안정화 → useEffect dependency 에 `repo` 가 포함되어도 spurious refire 없음.
- 영속화 effect 의 first-run skip 패턴 (useRef firstRun) 보존 — 초기 로드 직후 동일 상태로 save 되는 noisy I/O 회피.

### 2.4 ES 모듈 순환 import 검토
`persist.ts` ↔ `local-repository.ts` 가 `KEYS` / `PersistedState` 와 `LocalRepository` 를 통해 순환한다.
- `LocalRepository` 는 **클래스** — 모듈 평가 시점에는 식별자만 export, `KEYS` 참조는 **메서드 호출 시점**에 발생.
- ES Modules live bindings 으로 모듈 평가 완료 후 두 import 모두 정의됨.
- 실측: `npm run build` (tsc -b → vite build) 와 `vitest` 모두 그린, 런타임 오류 없음.

### 2.5 타입 안전성
- `any` / 강제 캐스팅 없음. `Lang` 은 `'ko' | 'en'` 유니온으로 명시.
- `LocalRepository.getLang()` 는 unknown 값에 대해 `'ko' || 'en'` 가드 → 항상 안전한 `Lang` 반환.
- `Storage.prototype.setItem` 모킹 (quota 테스트) 도 정식 시그니처 준수.
- `tsc -b` 통과.

---

## 3. 마이그레이션 노트 (persist → repository)

### 3.1 외부 영향 0
- 사용자 가시 동작 무변화 — 동일한 `cs_grass` / `cs_journal` / `cs_drills` / `cs_collected` / `cs_lang` 키로 동일 JSON 직렬화.
- 기존 영속 데이터를 가진 사용자: 첫 로드 시 동일 슬라이스 복원, 변경 시 동일 시점 (state 변화 effect) 에 동일 키로 저장.
- 시드 정책 무변화: 빈 localStorage 첫 진입 → seed 함수들 적용.

### 3.2 후속 PR 을 위한 사전 정비
- `Repository` 인터페이스 → PR⑤ 에서 `SupabaseRepository` 가 동일 인터페이스 구현 (네트워크 IO).
- `AppProvider.repository` prop → PR⑤ 의 `AuthGate` 가 세션 시 `SyncRepository(user)` 를, 비세션 시 `LocalRepository("local")` 를 주입.
- 본 PR 시점엔 user-prefix 키 (예: `cs:{userId}:grass`) 미도입 — 설계 §5.3 에 따라 PR⑤ 에서 한 번에 전환.

### 3.3 비-범위 (NO-GO 준수)
- SupabaseRepository / SyncRepository / `RepoChange` / `actionToChanges` 미구현 (PR⑤+)
- 인증 / AuthGate / OAuth 미터치 (PR⑥)
- `_workspace/` 의 다른 문서 (`01_architect_plan.md`, `03_qa_report.md` 등) 무수정
- 새 런타임 의존성 무추가 (devDependencies 도 무변화 — `package.json` diff 없음)
- 도메인 / 디자인 / CSS 무수정

---

## 4. 테스트 결과

### 4.1 신규 단위 테스트 (13 개)
`src/state/__tests__/local-repository.test.ts` 내 그룹:
- `getAll / loadAll` — 시드 폴백, 영속값 반환, JSON 손상 폴백, lang null 가드 (4)
- `grass` — round-trip + 레거시 키 (2)
- `journal` — seed 후 replace + 레거시 키 (1)
- `drills` — round-trip (1)
- `collected` — round-trip (1)
- `lang` — round-trip (1)
- `saveAll (batch)` — 전체 슬라이스 동시 저장, partial 미터치, storage 예외 안전성 (3)

### 4.2 `npx vitest run` (최종)
```
Test Files  16 passed (16)
     Tests  121 passed (121)
   Start at 14:07:23
   Duration 13.97s
===VITEST EXIT===0
```
- 기존 108 그린 유지 (회귀 0)
- 신규 13 그린

### 4.3 `npm run build` (최종)
```
> tsc -b && vite build
vite v5.4.21 building for production...
transforming...
✓ 92 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.11 kB │ gzip:  0.53 kB
dist/assets/index-BI--MW2y.css   21.05 kB │ gzip:  4.92 kB
dist/assets/web-iz2xofYc.js       0.12 kB │ gzip:  0.13 kB
dist/assets/web-CAUg57Q8.js       0.84 kB │ gzip:  0.40 kB
dist/assets/index-UkEXANnP.js   199.58 kB │ gzip: 66.53 kB
✓ built in 1.64s
===BUILD EXIT===0
```
- `tsc -b` 통과 (타입 오류 0)
- `vite build` 통과 (92 modules 변환 성공)

---

## 5. 작업단위 커밋 (이 PR 내)

| SHA | 메시지 |
|-----|--------|
| `5740dd4` | `refactor(state): introduce Repository interface and LocalRepository` |
| `5cb31df` | `refactor(state): delegate persist load/save to LocalRepository` |
| `f086b41` | `refactor(state): switch AppContext to Repository for persistence IO` |

모두 Conventional Commits 형식, `Co-Authored-By: Claude Opus 4.7 (1M context)` 트레일러 포함.

Base: `bbd59c0` (main)
Head: `f086b41` (feat/repository-abstraction)

---

## 6. 잔여 이슈 / 후속 작업

### 본 PR 내 미해결
없음. 모든 검증 게이트 통과 + 사용자 지시 범위 100% 달성.

### 후속 PR 권장 (이 PR 범위 외)
- **PR⑤ (SyncRepo)**: 본 PR 의 fine-grained 메서드 위에 큐·디바운스·LWW 머지 (per-day max 잔디 머지) 구축. `RepoChange` / `actionToChanges` 도입은 이 PR 에서.
- **호환층 정리**: `persist.ts` 의 `load`/`save` `@deprecated` 는 외부 테스트들이 `KEYS` 만 의존하도록 정리되면 (PR④/⑤ 작업 중 자연 발생) 제거 검토.
- **잠재 esbuild 주석 파싱 함정**: 한글 주석 + `*` `/` 문자 인접 (`get*/list*` 같은) 시 esbuild 의 esbuild-loader 가 fail 한 사례 1회 발생 (해결: 주석 표현을 영문/문자 회피로 변경). 향후 다른 모듈 작성 시 같은 패턴 주의.

### 비-범위 확인
- 디자인 변경, 신규 기능, 도메인 알고리즘 수정 — 모두 무진행. CLAUDE.md 의 Do Not 절을 준수.
- main 직접 push / merge — 무진행. 본인은 push / PR 생성하지 않음 (사용자가 QA 후 수행).

---

## 7. QA 핸드오프 메모

`qa-verifier` 가 확인할 경계면 (설계 §부록 B 의 B3 / B4 일부):

1. **B3 — Repository 계약**
   - `LocalRepository.loadAll()` → `saveAll(loaded)` → `loadAll()` 동치 (실측: 신규 테스트 `saveAll (batch)` 그룹).
   - 시드 폴백: 빈 / 손상 JSON → 도메인 시드 함수 결과 반환.

2. **B4 — AppContext 통합**
   - `<AppProvider>` 가 명시적 `repository` 없이 마운트 → 내부 `LocalRepository` 인스턴스가 사용됨. 기존 통합 테스트 (`PracticeView.test.tsx` 의 "logs practice → grass persists" + "submits a journal entry → prepended and persisted", `App.smoke.test.tsx` 의 "header log button records practice") 가 회귀 가드.
   - first-run skip 동작 보존 (초기 로드 직후 동일 상태 effect 가 noisy write 안 함).

3. **회귀 가드**
   - 기존 108 테스트 그린.
   - `appReducer` 순수성 보존 (reducer 무수정 / appReducer.test.ts 무수정).
   - `seed.ts` 무수정 / 도메인 무수정.

4. **PR 분리 게이트**
   - 무관한 변경 0 (3개 커밋 모두 영속화 추상화 범위 내).
   - 의존성 무추가, CSS 무수정, 도메인 무수정.
