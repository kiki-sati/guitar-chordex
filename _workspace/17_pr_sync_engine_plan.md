# 설계: PR⑤ `feat/sync-engine` — 동기화 엔진 + 로컬→클라우드 마이그레이션

> 산출물: `_workspace/17_pr_sync_engine_plan.md`
> 대상: implementer(체크포인트 후 착수), qa-verifier(검증 경계면 B5/B6)
> 정본: `_workspace/05_backend_auth_plan.md` §5(Repository)·§6(Sync/큐/머지)·§7(seed/마이그레이션)·§8 PR⑤·부록 B5/B6, `CLAUDE.md`(계층/불변값/PR 규칙).
> 통합 대상(현 머지 코드): `src/state/{repository.ts, local-repository.ts, supabase-repository.ts, AppContext.tsx, persist.ts, seed.ts, mappers.ts, appReducer.ts}`, `src/auth/{AuthProvider.tsx, AuthGate.tsx}`, `src/lib/supabase.ts`, `supabase/migrations/0001_init.sql`.
> **이 PR이 통합하는 실제 코드를 기준으로 설계**한다(정본 §5 스케치의 `repo/` 폴더·`RepoChange` 미들웨어 가정과 현 코드가 다름 — §0 참조).

## 0. 현실(현 코드) vs 정본 스케치 — 차이 고정

정본 §5는 `src/state/repo/{types,localRepo,supabaseRepo,syncRepo,memoryRepo,actionToChanges}` 폴더 구조와 `Repository.load(): Promise<PersistedState>`(비동기 단일 인터페이스)를 가정한다. **현 코드는 그와 다르게 안착**했다. PR⑤는 아래 사실을 단일 기준으로 삼는다.

| 항목 | 정본 §5 스케치 | 현 코드(사실) | PR⑤ 방침 |
|---|---|---|---|
| Repository 위치 | `src/state/repo/` | `src/state/repository.ts`(플랫) | 플랫 유지 |
| Repository.load | `load(): Promise<PersistedState>` (async 단일) | **`loadAll(): PersistedState` (동기)** + per-slice getter/setter | 동기 인터페이스 **불변**, 별도 **`AsyncRepository`** 신설(§4) |
| 쓰기 계약 | `apply(changes: RepoChange[])` | `saveAll(patch)` + per-slice setter | `RepoChange` **신설**하되 AppContext는 `saveAll(patch)` 유지 + **effect diff**로 change 산출(§5) |
| SupabaseRepository | `supabaseRepo.ts` (async) | `supabase-repository.ts` (async, **미배선**, per-entity 메서드) | **그대로 소비**(래핑만) — 시그니처 변경 없음 |
| 캐시 키 | `cs:{uid}:*` (정본 §5.3) | `cs_*` (LocalRepository 하드코드 KEYS) | LocalRepository에 **키 prefix 주입** 생성자 추가(§6) |
| AuthGate 주입 | SyncRepo(user)를 AppProvider에 주입 | AuthGate는 순수 분기(주입 없음), AppProvider는 `repository?` prop 보유 | AuthGate/App 트리에 **repo 결정 계층** 신설(§7) |
| 현재 테스트 수 | 문서상 158 | **187 (24 파일)** | 회귀 기준 = **187 + 신규** |

**핵심 경계 결정(정본 §8 PR⑤ 범위):** PR⑤는 (a) **비동기 초기화 도입**(SyncRepo.load = 캐시 즉시 + 백그라운드 pull), (b) **오프라인 큐 + 충돌 머지**, (c) **user-prefix 캐시 키**, (d) **마이그레이션 모달**, (e) **seed 정책 전환**을 한 단위로 담는다. **도메인 불변값(Quality/Fret/보이싱/기하)·`CollectedChord` 타입·reducer 순수성은 건드리지 않는다.**

---

## 1. 수용 기준 (AC) — 모두 테스트 관측 가능

정본 AC-3/4/5/7/10에 매핑. 각 AC는 단위/통합 테스트(vitest, mock supabase)로 관측 가능하게 재진술한다. (LIVE Supabase 연동은 사용자 준비물 — §12; 코드/테스트는 mock으로 지금 전부 검증 가능.)

- [ ] **AC⑤-1 (정본 AC-3 · 푸시):** 인증(configured+세션) 상태에서 잔디+1/일지작성/드릴체크(달성)/담기/드릴삭제 등 모든 변경이 (a) 로컬 user-prefix 캐시에 **즉시** 반영되고, (b) 온라인이면 SupabaseRepository의 해당 per-entity 메서드가 정확한 인자로 호출된다. [QA: B5 푸시]
- [ ] **AC⑤-2 (정본 AC-4 · 풀):** 로그인 직후 `SyncRepo.load()`가 (i) 캐시 상태를 즉시 반환하고, (ii) 백그라운드로 서버 pull → merge → 결과를 구독자(AppProvider)에 통지한다. 서버에만 있는 데이터(기기 A 기록)가 머지 후 상태에 나타난다. [QA: B5 풀]
- [ ] **AC⑤-3 (정본 AC-5 · 오프라인 큐):** 오프라인(`navigator.onLine===false`)에서 변경 → 로컬 캐시 즉시 반영 + 큐(`cs:{uid}:queue`)에 적재 + 서버 호출 없음. `online` 이벤트 발화 시 큐가 자동 flush되어 서버 upsert 호출·큐 비워짐. 데이터 유실 없음. [QA: B5 큐]
- [ ] **AC⑤-4 (정본 AC-10 · 충돌 머지):** pull+로컬 머지에서 grass는 per-day `max(local, server)`, journal/drills 메타는 `updated_at` LWW, collected는 name 기준 합집합 + soft-delete tombstone 반영, drill.count는 count 머지 규칙(§8.4). **카운트는 LWW로 덮지 않는다.** [QA: B5 머지]
- [ ] **AC⑤-5 (정본 AC-5 · 멱등):** 같은 change를 2회 apply/flush해도 서버 최종 상태와 로컬 상태는 1회와 동일(모든 쓰기 upsert 기반, grass `(user_id,day)` / journal·drill `id` / collected `(user_id,name)`). 큐 재시도가 중복 효과를 내지 않는다. [QA: B5 멱등]
- [ ] **AC⑤-6 (정본 AC-7 · 마이그레이션 제안):** 기존 `cs_*`(prefix 없는 legacy) 키에 데이터가 존재 + `profiles.migrated_at === null`이면 **1회** 마이그레이션 모달을 제안한다. 신규 유저(legacy 키 없음)에게는 뜨지 않는다. [QA: B6]
- [ ] **AC⑤-7 (정본 AC-7 · 마이그레이션 수행):** 모달에서 "가져오기" → legacy 데이터를 RepoChange로 변환 → SyncRepo에 apply(서버 머지 §8.4) → `profiles.migrated_at = now()` set → 재제안 안 됨. "새로 시작" → `migrated_at` set만(재제안 방지), legacy 키는 보존(롤백 대비). [QA: B6]
- [ ] **AC⑤-8 (정본 §7.1 · seed 전환):** 신규/인증 유저는 **빈 상태**로 시작(빈 GrassMap/journal/drills/collected, lang='ko' — seed 미적용). 로컬 전용 모드(`local-mode`)와 legacy 비로그인 경로는 seed 유지(기존 187 테스트 호환). [QA: seed 정책]
- [ ] **AC⑤-9 (멀티계정/로그아웃 격리):** 캐시 키는 `cs:{uid}:*`로 네임스페이스. 로그아웃(`SIGNED_OUT`) 시 현 user 캐시·큐를 정리하고 게이트가 LoginScreen 복귀(PR④ 동작 유지). 다른 계정 로그인 시 이전 유저 데이터가 노출되지 않는다. [QA: 격리]
- [ ] **AC⑤-10 (회귀 0 · 로컬 모드 무손상):** `isSupabaseConfigured===false`(로컬 모드, CI 포함)면 앱은 **동기 LocalRepository + seed** 경로 그대로(SyncRepo 미배선). 기존 **187 테스트 + `npm run build`** 그린. 뷰/리듀서/도메인 테스트 무변경. [QA: 회귀]

> **범위 밖(명시):** 네이티브 인증/딥링크(PR⑥ — `@capacitor/network` 온라인 감지 고도화 포함, PR⑤는 `navigator.onLine`+web `online` 이벤트만), RLS 정책 자체 검증(PR③ B1 완료분 재사용), 디바운스/배치 최적화(정본 §6.5 — MVP는 change별 즉시 push + 실패 재큐로 충분, 선택 후속), 이벤트-로그 잔디 정밀 집계(정본 §6.4 대안 — 후속 옵션).

---

## 2. 데이터/타입 설계

### 2.1 RepoChange (변경 단위 — 신설, 정본 §5.2)

큐 항목·머지·푸시의 공통 단위. `src/state/repo-change.ts`(신규, React·supabase 무의존, 테스트 1급).

```typescript
// src/state/repo-change.ts
import type { CollectedChord, Drill, GrassMap, JournalEntry } from '../domain/types';
import type { Lang } from './repository';

/** 엔티티별 변경 단위. reducer 결과 diff에서 산출(§5), 큐/머지/푸시 공통. */
export type RepoChange =
  | { kind: 'grass'; day: string; count: number }          // per-day 절대값(누적 카운트)
  | { kind: 'journal'; op: 'upsert'; entry: JournalEntry }
  | { kind: 'journal'; op: 'delete'; id: string }
  | { kind: 'drill'; op: 'upsert'; drill: Drill; sortOrder: number }
  | { kind: 'drill'; op: 'delete'; id: string }
  | { kind: 'collected'; op: 'upsert'; chord: CollectedChord }
  | { kind: 'collected'; op: 'delete'; name: string }        // name 자연키(§5 D4)
  | { kind: 'lang'; lang: Lang };

/** 큐 항목: change + LWW 기준 타임스탬프 + 멱등 식별자. */
export interface QueueItem {
  id: string;          // crypto.randomUUID() — 큐 내 항목 식별(중복 append 방지 아님, 재시도 추적용)
  change: RepoChange;
  updatedAt: string;   // ISO — 이 change의 LWW 기준(생성 시각). 재시도해도 불변.
}
```

> **왜 grass가 `count`(절대값)인가:** reducer의 `bumpToday`가 이미 `grass[today]`의 최종값을 만든다. change는 그 **절대 최종값**을 실어 나른다(델타 아님). 서버 upsert는 `(user_id,day)` 멱등 → 같은 change 2회 = 같은 최종값(AC⑤-5). per-day max 머지(§8.4)는 pull 시점에 적용.

### 2.2 grass 서버 저장에 필요한 GrassMap→행 변환 — 기존 `mappers.ts` 재사용

`grassMapToRows/grassRowsToMap`(현 `src/state/mappers.ts`)는 그대로 사용. **단, grass change 하나를 push할 때 전체 GrassMap이 아니라 해당 day 1건만 upsert**한다(정본 §6.5). SupabaseRepository.saveGrass는 현재 GrassMap 전체를 받으므로, PR⑤는 **1-day GrassMap**(`{ [day]: count }`)을 만들어 넘긴다(시그니처 변경 없이 최소 push). ⇒ `syncRepo`에서 `{ [change.day]: change.count }`로 감싸 `saveGrass` 호출.

### 2.3 마이그레이션 상태 — profiles.migrated_at

`profiles.migrated_at`(0001_init.sql에 이미 존재, `ProfileRow.migrated_at: string | null`). SupabaseRepository는 현재 `migrated_at`을 노출하지 않으므로 **읽기/쓰기 메서드 2개 추가**(§4.3 D-EXT). legacy 키 존재 판정은 클라이언트 로컬(`localStorage`)에서 수행(§9).

---

## 3. 온라인 감지 — `src/sync/net.ts` (신설)

```typescript
// src/sync/net.ts — React·supabase 무의존, 테스트 1급.
/** 현재 온라인 여부. SSR/비브라우저 방어: navigator 부재 시 true(낙관). */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** online/offline 리스너 등록. 반환값은 해제 함수. */
export function onOnline(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', cb);
  return () => window.removeEventListener('online', cb);
}
```

> PR⑥에서 `@capacitor/network`로 네이티브 감지 고도화. PR⑤는 web `navigator.onLine`/`online` 이벤트만(범위 최소). 테스트는 `navigator.onLine`을 `Object.defineProperty`로 스텁 + `window.dispatchEvent(new Event('online'))`.

---

## 4. 결정 #1 (핵심·최고위험) — Repository 동기 → 비동기 전환

> **가장 위험한 부분.** 현 `AppProvider`는 `useReducer(reducer, undefined, () => initState(repo.loadAll()))`로 **동기 lazy init**하고, effect에서 `repo.saveAll(patch)`로 저장한다. SyncRepo는 `load()`가 비동기(캐시 즉시 + 백그라운드 pull)여야 한다. **동기 계약을 깨면 187 테스트·로컬 모드가 회귀**한다.

### 4.1 확정안 — "동기 인터페이스 불변 + AsyncRepository 신설 + 이중 초기화 경로"

**핵심 원리: 기존 동기 `Repository`를 승급하지 않는다.** 대신 별도 `AsyncRepository` 인터페이스를 신설하고, AppProvider가 **주입된 repo의 종류에 따라 두 초기화 경로 중 하나**를 탄다.

- **로컬 모드/테스트(주입 없음 또는 동기 repo):** 현행 동기 경로 100% 유지 → **회귀 0**.
- **인증 모드(AsyncRepository 주입):** 캐시 즉시 반영(loading 최소화) + 백그라운드 pull→merge→구독 통지.

```typescript
// src/state/repository.ts 에 추가 (기존 Repository 인터페이스는 불변)

/**
 * 비동기 영속화 어댑터(SyncRepo). load는 "캐시 즉시 반환" 계약:
 *   - loadCached(): 로컬 캐시(user-prefix) 즉시 동기 반환 → 초기 렌더 blocking 없음.
 *   - start(onMerged): 백그라운드 pull→merge 시작. merge 결과를 콜백으로 통지(1회 이상).
 *   - apply(changes): 캐시 즉시 머지 + 큐 적재 + (온라인) push.
 *   - dispose(): 리스너/구독 정리(online 이벤트 등).
 */
export interface AsyncRepository {
  /** 로컬 user-prefix 캐시 즉시 반환(동기). 없으면 빈 상태(seed 미적용 — AC⑤-8). */
  loadCached(): PersistedState;
  /** 백그라운드 pull→merge 시작. 머지된 PersistedState를 통지(초기 pull 완료 시 1회). */
  start(onMerged: (merged: PersistedState) => void): void;
  /** 변경 적용: 캐시 즉시 머지 + 큐 적재 + (온라인) push. */
  apply(changes: RepoChange[]): Promise<void>;
  /** 리스너/타이머 정리. */
  dispose(): void;
}

/** 주입 repo 판별(타입 가드). AppProvider가 경로 분기에 사용. */
export function isAsyncRepository(r: Repository | AsyncRepository): r is AsyncRepository {
  return typeof (r as AsyncRepository).loadCached === 'function';
}
```

### 4.2 AppProvider 상태머신 (동기·비동기 양립)

`AppProvider`가 받는 `repository?: Repository | AsyncRepository`를 분기한다.

```
초기 렌더:
  repo 없음 or 동기 Repository  ──► initState(repo.loadAll())         [기존 경로 · 동기 · 회귀 0]
  AsyncRepository              ──► initState(repo.loadCached())       [캐시 즉시 · blocking 없음]
                                    + useEffect: repo.start(merged => dispatch(HYDRATE, merged))
                                    + 언마운트 시 repo.dispose()

변경(dispatch 후):
  effect diff(prev→next) → changes[]
  동기 Repository  ──► repo.saveAll(patch)          [기존 경로 유지]
  AsyncRepository ──► void repo.apply(changes)      [캐시+큐+push]
```

- **로딩 스플래시 불필요:** `loadCached()`가 캐시를 즉시 주므로 **빈 화면 blocking이 없다**. 최초 로그인(캐시 없음)은 빈 상태로 렌더 후 pull 완료 시 `HYDRATE`로 채워짐(잔디 히트맵이 잠깐 비었다가 채워지는 정도 — 수용 가능, S8 완화). 필요 시 AppProvider가 `hydrating` 플래그를 노출해 뷰가 skeleton을 그릴 수 있으나 **MVP 범위 밖**(선택).
- **`HYDRATE` 액션 신설**(reducer): 서버 머지 결과로 persisted slice만 교체. **트랜션트 상태(뷰/드래프트/토스트/detail)는 보존**. reducer 순수성 유지(§4.4).

```typescript
// appReducer.ts 에 추가할 액션(유일한 reducer 변경)
| { type: 'HYDRATE'; persisted: PersistedState }
// 처리: return { ...state, grass, journal, drills, collected, lang } (persisted 4+lang만 교체)
```

> **왜 reducer에 HYDRATE를 추가하나(순수성 위배 아님):** 서버 pull 결과를 상태에 반영할 유일한 순수 경로. `HYDRATE`는 입력(persisted)만으로 결정적 → 순수. reducer의 **도메인 로직·기존 액션은 불변**. CLAUDE.md "reducer 순수 유지"와 정합(순수한 상태 교체 액션 추가는 허용).

### 4.3 회귀 최소화 근거 (왜 이 구조가 안전한가)

1. **동기 `Repository` 인터페이스·`LocalRepository.loadAll/saveAll` 시그니처 불변** → `AppContext` 기존 동기 경로, `persist.test.ts`, `local-repository.test.ts`, 모든 뷰 테스트(주입 없음 → 동기 경로) **회귀 0**.
2. **`test-utils.renderWithProvider`는 주입 없이 렌더** → 동기 경로 → 187 테스트 무영향.
3. **AsyncRepository는 인증+configured에서만 주입** → 로컬 모드/CI(env 없음)는 절대 async 경로 미진입(AC⑤-10).
4. **effect diff는 saveAll(기존)과 apply(신규)를 동시 만족**: 동기 repo는 patch만, async repo는 changes만 사용. diff 산출 로직(§5)이 양쪽 공용.

**트레이드오프(병기):**
- **대안 A(불채택): 단일 async 인터페이스로 승급** — 정본 §5 스케치. 깔끔하나 `loadAll` 전 호출부·187 테스트·로컬 모드 동기 경로를 전부 async로 바꿔야 함 → 회귀 표면 최대, PR 단위 초과. **불채택.**
- **대안 B(불채택): AuthGate에서 `await repo.load()` 후 initial prop 주입**(정본 §4.5 원안) — Provider는 동기 유지하나, AuthGate가 데이터 로딩까지 책임져 계층이 뭉치고 로딩 스플래시가 데이터 pull까지 늘어짐(오프라인 시 영영 안 뜸 위험). **불채택 — 캐시 즉시 반환이 오프라인 우선 원칙에 부합.**
- **채택안 근거:** "캐시 동기 즉시 + 백그라운드 async pull"이 정본 §6.3(pull→merge→push) + 오프라인 우선(§1.4)을 가장 직접 구현하며, 동기 경로 보존으로 회귀를 격리한다.

---

## 5. 결정 (change 산출) — dispatch 액션 → RepoChange 매핑

정본 §5.2는 "액션→change 매퍼(권장)" 또는 "prev/next diff" 중 택1. **현 AppContext가 이미 effect에서 prev/next를 알 수 있으므로(state는 이전 렌더 값 참조 가능), diff 방식이 기존 effect 구조에 최소 변경**이다. 단, 순수·테스트 용이성을 위해 diff 로직을 별도 순수 함수로 분리.

```typescript
// src/state/diff-changes.ts (신규, 순수, 테스트 1급)
import type { PersistedState } from './persist';
import type { RepoChange } from './repo-change';

/**
 * 이전/이후 persisted 슬라이스를 비교해 RepoChange[] 산출.
 * - grass:  count가 바뀐 day만 { kind:'grass', day, count }.
 * - journal: id 기준 신규/수정 upsert, 사라진 id delete.
 * - drills:  id 기준 신규/수정 upsert(sortOrder=인덱스), 사라진 id delete.
 * - collected: name 기준 신규 upsert, 사라진 name delete. (index 아님 — name 자연키)
 * - lang: 값 변경 시 { kind:'lang', lang }.
 */
export function diffChanges(prev: PersistedState, next: PersistedState): RepoChange[];
```

**핵심 diff 규칙(구현자 엄수):**
- **grass:** `next.grass[day] !== prev.grass[day]`인 day만. (bumpToday는 today 1건만 바꾸므로 보통 1건.)
- **collected — index 함정 주의:** reducer `REMOVE_COLLECTED`는 **index로 제거**(`filter((_,i)=>i!==index)`). diff는 index를 몰라도 되게 **name 집합 차집합**으로 산출한다: `prev.name - next.name = delete`, `next 신규/frets변경 = upsert`. ⇒ **name 기준 비교가 정답**(정본 §5 D4, 서버도 `(user_id,name)` upsert).
- **drills — RESET_DRILLS/bulk:** `RESET_DRILLS`는 모든 drill.count=0 → 변경된 각 drill을 upsert change로 산출(count가 바뀐 것만). sortOrder는 `next.drills` 배열 인덱스.
- **drill 달성 시 grass 동반:** `SET_DRILL_COUNT`(달성)는 drill upsert + grass(today) 2개 change 동시 산출 → diff가 두 슬라이스 모두 감지하므로 자동 처리.

> **왜 매퍼(action→change) 대신 diff인가(트레이드오프):** action→change 매퍼는 명시적이나 reducer 결과(신규 id 등)를 알아야 해 매퍼가 reducer 내부를 재현하게 됨(중복·취약). diff는 reducer를 신뢰(단일 진실)하고 슬라이스 비교만 → **reducer 무변경 + 테스트 용이**. 정본도 "Provider가 이전 state와 비교(diff)해 산출" 허용. **diff 채택.**

---

## 6. 결정 (캐시 키) — user-prefix `cs:{uid}:*` + legacy 마이그레이션 경로

### 6.1 LocalRepository에 키 prefix 주입

현 `LocalRepository`는 `KEYS`(`cs_grass`…)를 하드코드한다. **생성자에 선택적 `keyPrefix`를 추가**해 user별 네임스페이스를 만든다. **기본값(prefix 없음)은 기존 `cs_*` 그대로** → 로컬 모드/테스트 회귀 0.

```typescript
// local-repository.ts (변경 — 하위호환)
export class LocalRepository implements Repository {
  constructor(private readonly opts: { keyPrefix?: string; seedOnEmpty?: boolean } = {}) {}
  private key(base: keyof typeof KEYS): string {
    return this.opts.keyPrefix ? `${this.opts.keyPrefix}${KEYS[base]}` : KEYS[base];
    // 예) keyPrefix='cs:{uid}:' → 'cs:{uid}:cs_grass'  ← §6.2 참조(키 형태 확정)
  }
  // getGrass 등 read/write가 this.key(...) 사용. seedOnEmpty=false면 빈 상태 반환(AC⑤-8).
}
```

### 6.2 키 형태 확정(구현자 혼선 방지)

정본은 `cs:{uid}:grass`(prefix가 `cs_` 대체). 현 KEYS는 값에 `cs_`를 이미 포함. **혼선을 막기 위해 prefix는 KEYS 값을 대체하지 않고 앞에 붙인다**: 최종 키 = `` `${prefix}${KEYS.grass}` `` 형태로, **prefix에 `cs:` 접두를 넣지 않고** user 파트만 넣는다. 확정:

- **인증 유저 캐시 키:** `` `u:${uid}:` `` + `KEYS.grass` = `u:{uid}:cs_grass`. (읽기 쉽고 legacy `cs_*`와 명확히 구분.)
- **legacy(비로그인/기존 MVP):** prefix 없음 = `cs_grass`(불변).
- **큐 키:** `u:{uid}:cs_queue`(§8.2).
- **seedOnEmpty:** 인증 유저=`false`(빈 상태 AC⑤-8), 로컬 모드=`true`(seed 유지 AC⑤-8/§7.1).

> **결정 확정:** prefix 문자열은 `u:{uid}:`. 구현자는 이 형태를 상수 함수 `userKeyPrefix(uid) = ` `` `u:${uid}:` `` 로 두고 SyncRepo·마이그레이션·로그아웃 정리에서 공유한다.

### 6.3 legacy → user 캐시 마이그레이션 경로

legacy `cs_*` 키는 **user 캐시로 자동 복사하지 않는다**(다계정 오염 방지). 대신 **§9 마이그레이션 모달**이 legacy를 읽어 **서버로** 올리고(그 후 pull로 user 캐시가 채워짐), legacy 키는 보존(롤백 대비). 로그아웃 시 user 캐시/큐만 삭제, legacy는 불변.

---

## 7. 결정 (repo 주입) — AuthGate → AppProvider 배선

PR④에서 `AuthGate`는 순수 분기(주입 없음), `AppProvider`는 `repository?` prop 보유. PR⑤는 **repo 결정을 담당하는 얇은 배선 컴포넌트**를 신설해 `App.tsx`/트리 변경을 최소화한다.

### 7.1 트리 (신규 `RepoProvider` 삽입)

```
main.tsx
  <AuthProvider>
    <AuthGate>                         ← 순수 분기 (PR④ 불변)
      <App/>                           ← App() = <RepoBoundary><Shell/></RepoBoundary> (신규 경계)
```

- **`RepoBoundary`(신규, `src/state/RepoBoundary.tsx`):** `useAuth()`를 읽어 repo를 결정하고 `<AppProvider repository={repo}>`로 감싼다.
  - `status==='authenticated'` && `session.user.id` && `supabase` 존재 → `SyncRepo(user.id)` 생성·주입(+ MigrationController §9 마운트).
  - `status==='local-mode'`(env 없음) → **주입 없음**(AppProvider 기본 `LocalRepository()` = seed 유지, 동기 경로). ← AC⑤-10 회귀 0의 핵심.
  - `status==='unauthenticated'|'loading'` → 도달 불가(AuthGate가 이미 LoginScreen/Splash). 방어적으로 local seed repo.
  - repo 인스턴스는 `useMemo([user.id])`로 안정화(재마운트 최소화). user 전환 시 새 repo → AppProvider `key={user.id}`로 상태 리셋(다계정 격리, AC⑤-9).

```tsx
// src/state/RepoBoundary.tsx (개념)
export function RepoBoundary({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const uid = session?.user?.id ?? null;
  const repo = useMemo<AsyncRepository | undefined>(() => {
    if (status === 'authenticated' && uid && supabase)
      return new SyncRepo({ client: supabase, userId: uid });
    return undefined; // local-mode/기타 → 동기 LocalRepository(seed) fallback
  }, [status, uid]);
  return (
    <AppProvider key={uid ?? 'local'} repository={repo}>
      {status === 'authenticated' && uid && <MigrationController uid={uid} />}
      {children}
    </AppProvider>
  );
}
```

- **`App.tsx` 변경 최소:** `App()`이 `<AppProvider><Shell/></AppProvider>` → `<RepoBoundary><Shell/></RepoBoundary>`로 한 줄 교체(RepoBoundary가 AppProvider를 내부 소유). *대안:* main.tsx에 RepoBoundary 삽입 — App.tsx 무변경 가능하나 AuthGate와 AppProvider 사이 계층이 main에 뭉침. **App.tsx 내 교체 채택**(트리 책임 국소화).

### 7.2 AppProvider 변경 요약

- `repository?: Repository | AsyncRepository`로 타입 확장.
- `isAsyncRepository(repo)` 분기(§4.2): async면 `loadCached()` init + `start()`/`dispose()` effect + `apply(diffChanges(prev,next))`; sync면 기존 `loadAll()`/`saveAll(patch)` 경로.
- effect diff: prev 스냅샷을 `useRef`로 보관(현 firstRun ref 패턴 확장). 첫 마운트는 skip(기존과 동일).

---

## 8. 결정 (오프라인 큐 + 동기화 엔진) — `src/sync/`

### 8.1 파일 구성(정본 §6.1)

```
src/sync/
  net.ts          # isOnline / onOnline (§3)
  queue.ts        # 큐 로드/추가/제거/조회 (localStorage user-prefix 키)
  merge.ts        # 충돌 머지 순수 함수 (§8.4) — 정본 §6.4
  syncEngine.ts   # pull → merge → push 오케스트레이션 (SupabaseRepository 소비)
src/state/
  sync-repository.ts   # AsyncRepository 구현: LocalRepo(캐시) + queue + syncEngine 조합
```

> **위치 결정:** 순수 동기화 로직(net/queue/merge/syncEngine)은 `src/sync/`(정본 지정). `AsyncRepository` **구현체**(`SyncRepo`)는 다른 repo와 나란히 `src/state/`에 둔다(repository.ts 인접 — 응집). 정본 §5.3의 `syncRepo.ts`를 `src/state/sync-repository.ts`로 안착(현 코드 네이밍 컨벤션 `*-repository.ts` 일치).

### 8.2 queue.ts (오프라인 큐, 정본 §6.2)

```typescript
// src/sync/queue.ts — localStorage 직접(React 무의존). 키: `${userKeyPrefix(uid)}cs_queue`.
export interface SyncQueue {
  list(): QueueItem[];               // 큐 전체(FIFO 순서)
  enqueue(item: QueueItem): void;    // append
  remove(ids: string[]): void;       // flush 성공분 제거
  clear(): void;                     // 로그아웃 정리
}
export function createQueue(uid: string): SyncQueue;
```

- 항목 형태: `QueueItem`(§2.1). `enqueue`는 append(중복 제거 안 함 — 멱등은 upsert가 보장, §8.5).
- **큐 압축(선택 최적화, MVP 채택):** 같은 (kind,키)의 연속 change는 마지막 것만 유효(grass day / journal·drill id / collected name). enqueue 시 동일 대상 기존 항목 제거 후 append → 큐 비대·중복 push 감소. **멱등이라 정확성엔 무관, 효율만** → 채택하되 테스트로 고정.

### 8.3 syncEngine.ts (pull→merge→push, 정본 §6.3)

```typescript
// src/sync/syncEngine.ts — SupabaseRepository·mappers·merge 소비. React 무의존.
export interface SyncEngineDeps {
  remote: SupabaseRepository;   // 현 src/state/supabase-repository.ts 인스턴스
  local: LocalRepository;       // user-prefix 캐시 repo
  queue: SyncQueue;
}
/** 초기 동기화: 서버 pull → (캐시+큐) merge → 결과 반환 + 캐시 기록. push는 flushQueue가 담당. */
export async function initialSync(deps: SyncEngineDeps): Promise<PersistedState>;
/** 큐 flush: 온라인일 때 큐 항목을 remote per-entity 메서드로 push, 성공분 remove. 실패 잔류. */
export async function flushQueue(deps: SyncEngineDeps): Promise<void>;
/** 단일 change 즉시 push(온라인). 실패 시 throw → 호출자(SyncRepo)가 큐 잔류 처리. */
export async function pushChange(remote: SupabaseRepository, change: RepoChange): Promise<void>;
```

- **change → remote 메서드 매핑(pushChange):**
  - `grass` → `remote.saveGrass({ [day]: count })` (1-day 맵, §2.2)
  - `journal upsert` → `remote.upsertJournal(entry)` / `journal delete` → `remote.deleteJournal(id)`
  - `drill upsert` → `remote.upsertDrill(drill, sortOrder)` / `drill delete` → `remote.deleteDrill(id)`
  - `collected upsert` → `remote.upsertCollected(chord)` / `collected delete` → `remote.deleteCollected(name)`
  - `lang` → `remote.setLang(lang)`
- **initialSync 순서:** `remote.loadAll()`(pull, 이미 deleted_at 필터) → `merge(server, cache, queuePending)` → 캐시에 `saveAll(merged)` → return merged. (push는 `flushQueue`로 분리 — 큐에 미전송분이 있으면 온라인 시 push.)

### 8.4 merge.ts (충돌 머지, 정본 §6.4) — **결정 확정**

```typescript
// src/sync/merge.ts — 순수. 정본 §6.4 규칙 이식.
export function mergePersisted(
  server: PersistedState,      // pull 결과
  local: PersistedState,       // 로컬 캐시(미push 반영된 낙관적 상태)
): PersistedState;
```

**엔티티별 규칙(엄수):**

| 엔티티 | 규칙 | 근거 |
|---|---|---|
| **grass** | per-day `count = max(local[day], server[day])`. 양쪽 합집합 day. | 누적 카운트 손실 방지(정본 §6.4). **LWW 금지.** |
| **journal** | id별 존재 합집합. 양쪽 있으면 `updated_at` LWW. server에서 `deleted_at`(tombstone) → 로컬에서 제거. | 독립 레코드 |
| **drills(meta)** | id별 title/target/seq/sheetId/timeSig는 `updated_at` LWW. | 메타데이터 |
| **drills.count** | `updated_at`이 최신인 쪽 값, **동률이면 `max`**. (RESET의 명시적 0 의도 보존 + 누적 손실 방지) | 정본 §6.4 |
| **collected** | name 기준 합집합. `deleted_at` LWW로 삭제 반영. frets/key는 LWW. | 집합 의미(정본) |
| **lang** | `updated_at` LWW. | 단일 설정 |

> **문제: 현 PersistedState/도메인 타입에 `updated_at`이 없다.** JournalEntry/Drill/CollectedChord는 서버 전용 필드(updated_at)를 도메인에 누출하지 않는다(mappers 규칙). ⇒ **merge는 도메인 객체가 아니라 "행(Row) 레벨 또는 updatedAt 동반 뷰"에서 수행**해야 LWW가 가능하다. **확정 설계:**
> - `initialSync`는 `remote.loadAll()`(도메인 PersistedState)만으로는 updated_at을 못 얻음 → **merge용으로 updated_at을 보존하는 경로가 필요**.
> - **채택안: grass·collected 합집합·journal/drill 존재 병합은 updated_at 없이도 가능(합집합·max·tombstone)**. LWW가 진짜 필요한 건 "양쪽에 같은 id/키가 있고 내용이 다른" 드문 동시편집. **MVP 단순화:** journal/drill 동일 id 충돌 시 **로컬 우선(local wins)** — 로컬이 방금 사용자가 만든 낙관적 최신값이라는 전제(오프라인 우선). collected 동일 name은 **server 존재 + local 존재 = 유지(합집합), 삭제는 local 낙관값 우선**. **updated_at 기반 정밀 LWW는 후속**(도메인에 updated_at을 실어야 하므로 타입 변경 필요 → CollectedChord 불변 원칙과 충돌 → **후속 PR로 이연**).
> - **트레이드오프 병기:** (a) *로컬 우선 단순 머지*(채택) — 타입 무변경, CollectedChord 불변 준수, 동시편집 시 원격 편집 손실 가능(드묾). (b) *updated_at 실은 정밀 LWW* — 정확하나 PersistedState/도메인 타입에 updated_at 추가 필요(경계면·CollectedChord 불변 위배) → **불채택(범위·불변 위반)**. **grass max·collected 합집합·tombstone은 (a)에서도 정확** → 데이터 유실 핵심 위험(누적 카운트)은 방어됨.

**⚠️ 사용자 확인 필요(§13 Q1):** 위 "journal/drill 동시편집 시 로컬 우선(정밀 LWW 이연)"이 수용 가능한지. 정본 §6.4는 LWW를 명시하나, 도메인 타입에 updated_at을 넣지 않는 현 경계(CollectedChord 불변)와 충돌한다. **누적 카운트(grass/drill.count) 손실 방지는 채택안에서도 보장**되며, 실질 위험은 "두 기기에서 같은 일지를 동시에 수정"이라는 희귀 케이스뿐.

### 8.5 SyncRepo (`src/state/sync-repository.ts`) — AsyncRepository 구현

```typescript
export class SyncRepo implements AsyncRepository {
  // 구성: local(LocalRepository, user-prefix, seedOnEmpty:false) + queue + remote(SupabaseRepository) + net
  loadCached(): PersistedState { return this.local.loadAll(); }          // 즉시(빈 상태 가능)
  start(onMerged) {
    void initialSync({remote,local,queue}).then(onMerged);                // pull→merge→캐시→통지
    void flushQueue({remote,local,queue});                                // 미전송 큐 push
    this.unsub = onOnline(() => void flushQueue({remote,local,queue}));   // 복귀 시 재flush
  }
  async apply(changes) {
    // 1) 캐시 즉시 머지: local.saveAll(적용된 patch)  (낙관적)
    // 2) 각 change: 온라인이면 pushChange 시도; 실패/오프라인이면 queue.enqueue
    // 3) grass day/journal·drill id/collected name 단위 upsert → 멱등(AC⑤-5)
  }
  dispose() { this.unsub?.(); }
}
```

- **멱등(AC⑤-5):** 모든 push가 upsert(`onConflict`) → change 2회 = 최종 1회. 큐 재시도가 remove 전 크래시로 2회 실행돼도 upsert라 안전.
- **온라인 즉시 push 실패 시:** enqueue로 폴백(오프라인과 동일 경로) → `online`/다음 apply/flush에서 재시도.
- **로그아웃 정리(AC⑤-9):** `SIGNED_OUT` 시 RepoBoundary가 언마운트되며 `dispose()` + user 캐시/큐 clear. (signOut 핸들러 또는 AuthProvider effect에서 `queue.clear()` + user KEYS 제거. §11.)

---

## 9. 결정 (마이그레이션 모달) — `MigrationController` + `MigrationModal`

정본 §7.2. 기존 MVP를 로컬로 써온 유저가 첫 로그인 시 legacy `cs_*` 데이터를 계정으로 1회 가져오기.

### 9.1 판정 로직 (`src/sync/migration.ts`, 순수 + localStorage 읽기)

```typescript
/** legacy(prefix 없는) cs_* 키에 유의미 데이터가 있는가. */
export function hasLegacyData(): boolean;   // cs_grass/cs_journal/cs_drills/cs_collected 중 비어있지 않은 것
/** legacy localStorage → PersistedState 로드(LocalRepository() 기본 = seed 폴백 주의!). */
export function loadLegacy(): PersistedState;  // seedOnEmpty:false로 읽어 seed 혼입 방지
/** PersistedState 전체 → RepoChange[] (마이그레이션 push용). */
export function legacyToChanges(p: PersistedState): RepoChange[];
```

> **함정:** `new LocalRepository()`(기본)는 빈 localStorage에 **seed를 반환**한다(get/list 폴백). 마이그레이션 판정/로드는 반드시 **`seedOnEmpty:false`**로 생성해 "진짜 사용자 데이터"만 본다. 안 그러면 신규 유저에게도 seed가 legacy로 오인돼 제안이 뜬다(AC⑤-6 위반).

### 9.2 흐름 (`MigrationController`)

```
mount(uid, authenticated):
  1. remote.getMigratedAt() 조회.
  2. if migratedAt !== null → 아무것도 안 함(이미 처리/제안됨). [AC⑤-6 재제안 방지]
  3. if !hasLegacyData() → migratedAt을 now()로 set(신규 유저 재판정 스킵) → 종료. [빈 상태]
  4. else → MigrationModal 표시.
      - "가져오기": syncRepo.apply(legacyToChanges(loadLegacy())) → remote.setMigratedAt(now())
                     → (legacy 키 보존) → 모달 닫기. pull이 이후 user 캐시 갱신.
      - "새로 시작": remote.setMigratedAt(now()) → 모달 닫기. legacy 보존.
```

- **1회성 보장:** `migrated_at` 서버 플래그가 단일 진실. 기기 여러 대라도 한 번 set되면 재제안 없음.
- **`MigrationModal`(신규 컴포넌트, CSS Modules + tokens.css):** PR④ LoginScreen 톤 재현. 카피는 `ko.migrate*`(i18n 신규). 접근성: `role="dialog"` `aria-modal`.
- **RepoBoundary가 authenticated에서만 마운트**(§7.1) → local-mode/미인증은 절대 안 뜸(AC⑤-6).

### 9.3 SupabaseRepository 확장(D-EXT, §4.3에서 예고)

현 `SupabaseRepository`에 migrated_at 접근 2메서드 추가(**per-entity 패턴 일관·시그니처 최소**):

```typescript
async getMigratedAt(): Promise<string | null>;   // profiles select migrated_at where id=uid
async setMigratedAt(ts: string): Promise<void>;  // profiles upsert { id, migrated_at, updated_at }
```

> 도메인/PersistedState에 migrated_at을 누출하지 않는다(계정 메타 — profiles 전용). SupabaseRepository 내부 한정.

---

## 10. 결정 (seed 정책 전환, 정본 §7.1)

- **인증 유저:** `SyncRepo`의 캐시 LocalRepository를 `seedOnEmpty:false`로 생성 → 빈 상태 시작(AC⑤-8). `SupabaseRepository.loadAll`도 이미 빈 유저에 seed 미적용(현 코드 확인).
- **로컬 전용 모드(env 없음)/legacy 비로그인:** `AppProvider` 기본 `new LocalRepository()`(seedOnEmpty 기본 `true`) → **seed 유지**. 기존 187 테스트(persist.test seeds on first load 등) 호환.
- **`seed.ts` 자체는 변경 없음**(삭제 금지 — 로컬 모드·테스트 픽스처로 존속, 정본 §7.1). `LocalRepository`가 `seedOnEmpty` 플래그로 seed 적용 여부만 제어.

---

## 11. 신규/변경 파일 맵

**신규 (new):**
```
src/state/repo-change.ts              # RepoChange, QueueItem 타입 (§2.1)
src/state/diff-changes.ts             # diffChanges(prev,next): RepoChange[] (§5)
src/state/sync-repository.ts          # SyncRepo (AsyncRepository 구현) (§8.5)
src/state/RepoBoundary.tsx            # useAuth→repo 결정, AppProvider 주입 (§7)
src/sync/net.ts                       # isOnline / onOnline (§3)
src/sync/queue.ts                     # SyncQueue (localStorage user-prefix) (§8.2)
src/sync/merge.ts                     # mergePersisted 순수 머지 (§8.4)
src/sync/syncEngine.ts                # initialSync / flushQueue / pushChange (§8.3)
src/sync/migration.ts                 # hasLegacyData / loadLegacy / legacyToChanges (§9.1)
src/components/MigrationModal.tsx      # 마이그레이션 모달 UI (§9.2)
src/components/MigrationModal.module.css
src/state/MigrationController.tsx      # 판정→모달 오케스트레이션 (§9.2) — 또는 components/
  __tests__:
  src/state/__tests__/diff-changes.test.ts
  src/state/__tests__/sync-repository.test.ts
  src/sync/__tests__/queue.test.ts
  src/sync/__tests__/merge.test.ts
  src/sync/__tests__/syncEngine.test.ts
  src/sync/__tests__/net.test.ts
  src/sync/__tests__/migration.test.ts
  src/state/__tests__/RepoBoundary.test.tsx
  src/components/__tests__/MigrationModal.test.tsx  (또는 MigrationController)
```

**변경 (changed):**
```
src/state/repository.ts        # AsyncRepository 인터페이스 + isAsyncRepository 가드 추가 (§4.1). Repository 불변.
src/state/local-repository.ts  # 생성자 { keyPrefix?, seedOnEmpty? } 추가, this.key() 도입 (§6). 기본 동작 불변.
src/state/AppContext.tsx       # repository: Repository|AsyncRepository, isAsync 분기 init/effect, HYDRATE dispatch (§4.2/§7.2)
src/state/appReducer.ts        # HYDRATE 액션 1개 추가(persisted slice 교체 — 순수) (§4.2). 기존 액션 불변.
src/state/supabase-repository.ts # getMigratedAt/setMigratedAt 2메서드 추가 (§9.3). 기존 메서드 불변.
src/App.tsx                    # <AppProvider><Shell/> → <RepoBoundary><Shell/> 한 줄 교체 (§7.1)
src/auth/AuthProvider.tsx      # (선택) signOut 시 user 캐시/큐 clear 훅 — 또는 RepoBoundary dispose에서 (§8.5/§11 결정)
src/i18n/strings.ts            # ko에 migrate* 키 추가 (§9.2)
```

**변경 금지 (do NOT touch):**
```
src/domain/**                  # 도메인 타입/로직 (Quality/Fret/보이싱/기하) — 불변 (CLAUDE.md)
src/domain/types.ts            # CollectedChord(id 없음)/Drill/JournalEntry — 불변 (§8.4 근거)
src/state/mappers.ts           # 서버행↔도메인 매퍼 — 그대로 소비 (grass 1-day 맵만 §2.2)
src/state/persist.ts           # KEYS/PersistedState 불변 (LocalRepository가 prefix로 확장)
src/state/seed.ts              # seed 함수 불변 (seedOnEmpty 플래그로 제어만) (§10)
src/lib/supabase.ts            # PR② 완성분 불변
src/auth/AuthGate.tsx          # PR④ 순수 분기 불변
src/test-utils.tsx             # renderWithProvider 불변 (동기 경로 → 회귀 0 핵심)
```

---

## 12. 단계별 빌드 순서 (TDD, 작은 커밋 단위)

각 단계는 독립 커밋 + `npm run build`/관련 테스트 그린. 순수 함수(무의존)부터 상향식으로 쌓아 회귀 표면을 국소화한다.

1. **타입 토대** — `repo-change.ts`(RepoChange/QueueItem), `repository.ts`에 `AsyncRepository`+`isAsyncRepository`. (컴파일만, 테스트 없음.) → 빌드 그린.
2. **`diff-changes.ts` (TDD)** — 테스트 먼저: grass 1-day, journal upsert/delete(id 소멸), drill upsert/delete/RESET bulk, **collected name 기준 delete(index 함정)**, lang, 잔디 동반 케이스. → 구현. (§5)
3. **`net.ts` (TDD)** — isOnline(navigator 스텁)/onOnline(online 이벤트 dispatch→cb). (§3)
4. **`queue.ts` (TDD)** — enqueue/list(FIFO)/remove/clear + 큐 압축(동일 대상 최신만). user-prefix 키. (§8.2)
5. **`merge.ts` (TDD)** — grass per-day max, journal 합집합+tombstone, drill.count 규칙, collected 합집합+삭제, lang. **누적 카운트 손실 방지 골든 케이스**(정본 §6.4 예: A오프라인+3 vs B+2 → max). (§8.4)
6. **`local-repository.ts` 확장 (TDD)** — keyPrefix로 user 네임스페이스 read/write, seedOnEmpty:false 빈 상태. **기존 local-repository.test.ts 회귀 0 확인**(기본 생성자 불변). (§6)
7. **`syncEngine.ts` (TDD)** — mock SupabaseRepository: initialSync(pull→merge→캐시), pushChange(change별 정확한 remote 메서드·인자), flushQueue(성공분 remove·실패 잔류). (§8.3)
8. **`supabase-repository.ts` 확장 (TDD)** — getMigratedAt/setMigratedAt mock client 검증. 기존 메서드 테스트 회귀 0. (§9.3)
9. **`sync-repository.ts` = SyncRepo (TDD)** — loadCached 즉시, apply(온라인→push / 오프라인→enqueue), start(initialSync+flush+online 리스너), dispose. 멱등(2회 apply=1회 효과). (§8.5) [B5 핵심]
10. **`appReducer.ts` HYDRATE (TDD)** — persisted 4슬라이스+lang 교체, 트랜션트 보존. 기존 appReducer.test.ts 회귀 0. (§4.2)
11. **`AppContext.tsx` 분기 (TDD)** — async repo 주입 시 loadCached init + start/dispose effect + apply(diff); 동기 repo 시 기존 경로. mock AsyncRepo spy로 apply 호출 검증. **187 회귀 0**(주입 없음 = 동기). (§7.2) [B5]
12. **`migration.ts` (TDD)** — hasLegacyData(seedOnEmpty:false로 seed 오인 방지), loadLegacy, legacyToChanges. (§9.1) [B6]
13. **`SupabaseRepository` migrated_at + `MigrationController`/`MigrationModal` (TDD)** — 판정 4분기(migratedAt≠null/legacy없음/legacy있음→모달/가져오기·새로시작), 재제안 방지. RTL로 모달 렌더·버튼→apply/setMigratedAt. (§9.2) [B6]
14. **`RepoBoundary.tsx` (TDD)** — status별 repo 결정(authenticated→SyncRepo, local-mode→기본), key=uid 격리, MigrationController 마운트. mock useAuth. (§7.1)
15. **`App.tsx` 배선 + i18n** — RepoBoundary 삽입, migrate* 문자열. 스모크.
16. **전체 회귀** — `npm test`(187+신규) + `npm run build` 그린. → PR 생성(자동 머지 게이트 대기).

> **커밋 경계 권장:** 1 / 2 / 3-4 / 5 / 6 / 7-8 / 9 / 10-11 / 12-13 / 14-15 / 16(회귀·PR). 각 커밋 Conventional Commits(`feat(sync): ...`). 브랜치 `feat/sync-engine`.

---

## 13. 검증 경계면 B5/B6 — 단위 테스트 케이스 목록

### B5 — 동기화 (생산자: syncEngine/queue/SyncRepo/merge · 소비자: SupabaseRepository/캐시)

**merge (`merge.test.ts`):**
- B5-M1 grass per-day: local `{d1:3}` + server `{d1:2, d2:1}` → `{d1:3, d2:1}` (max + 합집합).
- B5-M2 grass 재설치 시나리오: local `{}`(빈 캐시) + server `{d1:5}` → `{d1:5}` (서버 보존).
- B5-M3 journal 합집합: local [A] + server [B] → [A,B] (id 기준).
- B5-M4 journal tombstone: server가 id=X를 deleted(loadAll이 이미 필터 → server에 없음) + local에 X → **로컬 우선 유지**(채택안 §8.4-a) 또는 tombstone 규칙 명시. (⚠️ Q1 확정에 따라 케이스 고정)
- B5-M5 collected 합집합: local [Cmaj7] + server [G] → [Cmaj7, G] (name 기준, 중복 name 1개).
- B5-M6 collected 삭제: local에서 제거된 name → 결과에서 제외(local 낙관 우선).
- B5-M7 drill.count: 같은 id, local.count=5 server.count=3 → 5(max/최신). RESET(count=0) 최신 → 0 보존.
- B5-M8 lang LWW/로컬 우선.

**queue (`queue.test.ts`):**
- B5-Q1 enqueue→list FIFO 순서.
- B5-Q2 remove(성공 ids)→잔여만 남음.
- B5-Q3 압축: 같은 grass day 2회 enqueue → 마지막 1건.
- B5-Q4 user-prefix 키 격리(uid A 큐 ≠ uid B 큐).

**syncEngine (`syncEngine.test.ts`, mock remote):**
- B5-E1 initialSync: remote.loadAll 1회 → merge → local.saveAll(merged) → merged 반환.
- B5-E2 pushChange grass → remote.saveGrass(`{[day]:count}`) 정확 인자.
- B5-E3 pushChange journal upsert/delete → upsertJournal/deleteJournal.
- B5-E4 pushChange drill upsert(sortOrder)/delete, collected upsert/delete(name), lang.
- B5-E5 flushQueue: 큐 3건 push 성공 → remove 3건, 큐 빔.
- B5-E6 flushQueue 부분 실패: 2번째 throw → 성공분만 remove, 실패분 잔류.

**SyncRepo (`sync-repository.test.ts`, mock remote+net):**
- B5-S1 loadCached: 캐시 데이터 즉시 동기 반환(빈 캐시 → 빈 상태, seed 없음).
- B5-S2 apply 온라인: 캐시 머지 + pushChange 호출, 큐 비어있음.
- B5-S3 apply 오프라인(`isOnline=false`): 캐시 머지 + enqueue, remote 호출 0.
- B5-S4 online 이벤트: 큐 잔류 → dispatch `online` → flushQueue 호출·큐 비움. [AC⑤-3]
- B5-S5 **멱등**: 같은 change 2회 apply → 서버 upsert 2회여도 최종 상태 = 1회(upsert). 캐시 동일. [AC⑤-5]
- B5-S6 start: initialSync 결과가 onMerged 콜백으로 통지(1회). dispose→online 리스너 해제.

**AppContext 통합 (`AppContext`/RepoBoundary 테스트, mock AsyncRepo):**
- B5-A1 async repo 주입 → loadCached로 init, start 호출, dispatch(LOG_PRACTICE) → apply([grass]) spy.
- B5-A2 onMerged 통지 → HYDRATE로 상태 갱신(서버 데이터 반영). [AC⑤-2]
- B5-A3 동기 repo(주입 없음) → apply 미호출·saveAll 경로(회귀 0).

### B6 — 마이그레이션 (생산자: legacy LocalRepo · 소비자: SyncRepo+profiles)

**migration (`migration.test.ts`):**
- B6-1 hasLegacyData: legacy cs_* 데이터 있음 → true; 빈 localStorage → **false**(seed 오인 없음, seedOnEmpty:false). [AC⑤-6]
- B6-2 loadLegacy: legacy 키에서 PersistedState 복원(seed 혼입 없음).
- B6-3 legacyToChanges: PersistedState → grass N + journal N + drill N + collected N + lang change[].

**MigrationController (`MigrationController`/Modal 테스트, mock remote):**
- B6-4 migratedAt≠null → 모달 미표시. [재제안 방지]
- B6-5 migratedAt=null & legacy 없음 → 모달 미표시 + setMigratedAt(now) 호출(재판정 스킵). [신규 유저 빈 상태 AC⑤-8]
- B6-6 migratedAt=null & legacy 있음 → 모달 표시.
- B6-7 "가져오기" → apply(legacyToChanges) + setMigratedAt 호출, 모달 닫힘. [AC⑤-7]
- B6-8 "새로 시작" → setMigratedAt만, apply 미호출, legacy 키 보존. [AC⑤-7]
- B6-9 local-mode/미인증 → MigrationController 미마운트(RepoBoundary 가드) → 모달 안 뜸. [AC⑤-6]

---

## 14. 회귀 위험 및 완화

| ID | 위험 | 영향 | 완화 |
|---|---|---|---|
| R1 | 동기→비동기 전환이 기존 187 테스트 회귀 | 전면 | **동기 Repository 불변 + AsyncRepository 별도**(§4). 주입 없으면 동기 경로. test-utils 불변. |
| R2 | LocalRepository keyPrefix가 기본 키 변경 | localStorage 데이터·persist.test 깨짐 | 기본값=prefix 없음(`cs_*` 불변). seedOnEmpty 기본 true. 기존 생성자(`new LocalRepository()`) 동작 100% 유지. |
| R3 | HYDRATE가 트랜션트 상태 덮음 | 뷰/드래프트/토스트 유실 | HYDRATE는 persisted 4+lang만 교체, 나머지 spread 보존. reducer 테스트로 고정. |
| R4 | 마이그레이션이 seed를 legacy로 오인 | 신규 유저에 모달 오발 | `seedOnEmpty:false`로 legacy 판정(§9.1 함정). B6-1/B6-5 테스트 게이트. |
| R5 | 누적 카운트 LWW 손실 | 잔디/드릴 데이터 유실 | grass per-day max, drill.count 최신/max(§8.4). LWW 금지. B5-M1/M2/M7. |
| R6 | 다계정 캐시 혼선 | 이전 유저 데이터 노출 | user-prefix 키 + AppProvider `key={uid}` + signOut 정리(§8.5/§11). AC⑤-9. |
| R7 | grass 전체 push 비효율/충돌 | 성능·충돌 | change day 1건만 upsert(§2.2). B5-E2. |
| R8 | StrictMode 이중 마운트로 start/dispose 2회 | 리스너 누수·이중 pull | dispose 멱등, online 리스너 해제 확실. initialSync 재실행은 upsert·max라 안전. |
| R9 | 온라인 즉시 push 실패 시 유실 | 데이터 유실 | 실패=enqueue 폴백(오프라인과 동일). online/다음 apply에서 재시도. B5-S2 변형. |
| R10 | CollectedChord 타입 변경 유혹(updated_at) | 경계면·불변 위반 | **타입 불변**(§8.4-a 로컬 우선 채택). 정밀 LWW는 후속. Q1 확인. |

---

## 15. 롤백 / 안티-브릭

- **env 없음(로컬 모드) = 항상 안전:** SyncRepo 미배선, 동기 LocalRepository+seed 그대로. 이 PR이 로컬 모드/CI를 절대 브릭하지 않음(AC⑤-10).
- **legacy 키 보존:** 마이그레이션은 legacy `cs_*`를 삭제하지 않음(가져오기/새로시작 모두) → 앱을 이전 버전으로 되돌려도 로컬 데이터 복원(롤백 안전).
- **큐/캐시 손상 방어:** queue/local read는 JSON parse 실패를 삼키고 빈 배열/빈 상태 폴백(현 LocalRepository read 패턴 답습) → 손상 캐시가 앱을 크래시시키지 않음.
- **서버 미도달:** initialSync/flushQueue 실패는 throw를 삼키고 캐시 상태로 계속 동작(오프라인 우선). 다음 online/apply에서 재시도.
- **PR 되돌리기:** RepoBoundary가 async repo를 주입하는 유일 지점 → 이 컴포넌트를 `<AppProvider>`로 되돌리면 즉시 동기 로컬 동작으로 복귀(코드 롤백 국소).

---

## 16. 도메인 불변 / 범위 재확인 (CLAUDE.md 준수)

- **도메인 불변값 무변경:** `Quality`(58종)·`Fret`(number|'x', length 6)·보이싱(`bestVoicing`/`allVoicings`)·다이어그램 기하(`computeDiagram`/SVG)·`buildChord` 우선순위 — **이 PR은 일절 건드리지 않는다**. 동기화는 `src/domain/` 바깥(state/sync)에서만 동작.
- **CollectedChord 타입 불변(§5 name 기준 upsert):** id 미부여, name 자연키. merge/diff/push 전부 name 기준(§5·§8.4). updated_at을 도메인에 넣지 않음(§8.4-a).
- **계층 분리:** 동기화·머지·큐는 순수 모듈(`src/sync/`, React·supabase 무의존). supabase 접근은 SupabaseRepository 단일 경유. UI(MigrationModal)는 컨트롤러 메서드만 호출.
- **단일 작업단위:** 이 PR = 동기화 엔진 + 마이그레이션 한 단위. 네이티브 인증/딥링크·디바운스 배치·이벤트로그 잔디는 **명시적 제외**(PR⑥/후속). RLS는 PR③ 완료분 재사용(재검증만).
- **PR 규칙:** 브랜치 `feat/sync-engine`, Conventional Commits, `main` 직접 push 금지, 자동 머지 게이트(`Build & Test (web)`) 우회 금지.

---

## 17. 사용자 확인이 필요한 열린 질문

- **Q1 (머지 정밀도 — 가장 중요):** §8.4에서 journal/drill의 **동시편집 충돌**을 정밀 `updated_at` LWW 대신 **"로컬 우선"**으로 단순화했다. 이유: 정밀 LWW는 도메인 타입(JournalEntry/Drill/CollectedChord)에 `updated_at`을 실어야 하는데, 이는 **CollectedChord 불변·경계면 안정 원칙과 충돌**한다. **누적 카운트(grass/drill.count) 손실 방지는 채택안에서도 완전 보장**되며, 손실 위험은 "두 기기에서 같은 일지/드릴 메타를 동시에 수정"이라는 희귀 케이스뿐. → **이 단순화를 수용할지, 아니면 정밀 LWW를 위해 도메인 타입에 updated_at을 추가(불변 완화)할지** 확인 필요. (권장: 단순화 채택, 정밀 LWW는 후속 PR.)
- **Q2 (하이드레이션 UX):** 최초 로그인(캐시 없음) 시 빈 상태로 잠깐 렌더 후 pull 완료 시 채워진다(스켈레톤 없음, §4.2). 잔디/일지가 순간 비었다 채워지는 UX를 수용할지, 아니면 최초 pull 동안 로딩 스플래시를 띄울지(오프라인 시 안 뜰 위험 있어 비권장). (권장: 빈→채움 수용, MVP.)
- **Q3 (grass 정밀 집계):** per-day `max`는 "같은 날 두 기기에서 각각 +N"을 합산 못 하고 큰 쪽만 취한다(정본 §6.4 수용 명시 — 잔디는 0~4 버킷 시각화라 무관). 정밀 합산이 필요하면 이벤트-로그 테이블(후속). (권장: max 채택.)
- **Q4 (온라인 감지 범위):** PR⑤는 web `navigator.onLine`+`online` 이벤트만. 네이티브 `@capacitor/network`는 PR⑥. 네이티브에서 오프라인 큐 flush 타이밍이 web 이벤트에 의존(포그라운드 복귀 flush는 PR⑥ appStateChange). 수용 확인. (권장: 범위대로.)

> Q1은 **구현 착수 전 반드시 확정**(머지 로직·테스트 케이스 B5-M4가 여기 걸림). Q2~Q4는 MVP 기본값(권장안)으로 진행 가능하되 명시 동의 권장.
