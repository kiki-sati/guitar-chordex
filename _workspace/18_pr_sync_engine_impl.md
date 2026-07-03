# 구현 로그: PR⑤ `feat/sync-engine` — 동기화 엔진 + 로컬→클라우드 마이그레이션

> 구현 정본: `_workspace/17_pr_sync_engine_plan.md` (§4 동기→비동기, §5 diff, §8 큐/머지/엔진/SyncRepo, §9 마이그레이션, §11 파일 맵, §12 16단계, §13 B5/B6).
> 브랜치: `feat/sync-engine` (main 최신 기반). 사용자 확정 결정: Q1=로컬 우선, Q2=빈→채움, Q3=grass max, Q4=web navigator.onLine만.

## 1. 검증 결과 (최종)

| 검증 | 명령 | 결과 |
|---|---|---|
| 타입 | `npx tsc -b` | **exit 0** |
| 테스트 | `npx vitest run` | **300 passed (40 files)** — 기존 187 + 신규 113, 실패 0 |
| 빌드 | `npm run build` (tsc -b && vite build) | **exit 0** (built in ~9s) |

신규 테스트 수(파일별): diff-changes 19 · net 6 · queue 11 · merge 16 · local-repository.prefix 6 ·
syncEngine 11 · supabase-repository.migration 4 · sync-repository 9 · apply-changes 5 ·
appReducer.hydrate 3 · AppContext.async 4 · migration 7 · MigrationController 5 · RepoBoundary 3 ·
MigrationModal 3 · strings.migrate 1 = **113 신규**. (기존 187 회귀 0.)

## 2. 파일 맵

### 신규 (new)
```
src/state/repo-change.ts               # RepoChange, QueueItem 타입 (§2.1)
src/state/user-keys.ts                 # userKeyPrefix/queueKey/userCacheKeys (§6.2) — 계획 외 헬퍼(공유 상수)
src/state/diff-changes.ts              # diffChanges(prev,next): RepoChange[] (§5)
src/state/apply-changes.ts             # applyChanges(state,changes): PersistedState — SyncRepo 낙관 캐시용(계획 §8.5-1 구체화)
src/state/sync-repository.ts           # SyncRepo (AsyncRepository 구현) (§8.5)
src/state/RepoBoundary.tsx             # useAuth→repo 결정, AppProvider 주입 (§7)
src/state/MigrationController.tsx      # 판정→모달 오케스트레이션 (§9.2)
src/components/MigrationModal.tsx       # 마이그레이션 모달 UI (§9.2)
src/components/MigrationModal.module.css
src/sync/net.ts                        # isOnline / onOnline (§3)
src/sync/queue.ts                      # SyncQueue (localStorage user-prefix, 압축) (§8.2)
src/sync/merge.ts                      # mergePersisted 순수 머지 (§8.4)
src/sync/syncEngine.ts                 # initialSync / flushQueue / pushChange (§8.3)
src/sync/migration.ts                  # hasLegacyData / loadLegacy / legacyToChanges (§9.1)
  __tests__ (신규): diff-changes, apply-changes, sync-repository, AppContext.async,
    appReducer.hydrate, local-repository.prefix, supabase-repository.migration,
    MigrationController, RepoBoundary (src/state/__tests__)
    net, queue, merge, syncEngine, migration (src/sync/__tests__)
    MigrationModal (src/components/__tests__), strings.migrate (src/i18n/__tests__)
```

### 변경 (changed)
```
src/state/repository.ts          # AsyncRepository 인터페이스 + isAsyncRepository 가드 추가. Repository 불변.
src/state/local-repository.ts    # 생성자 { keyPrefix?, seedOnEmpty? } + this.key(). 기본 동작 불변(회귀 0).
src/state/AppContext.tsx         # repository: Repository|AsyncRepository, isAsync 분기 init/effect,
                                 #   start(onMerged→HYDRATE)/dispose, apply(diffChanges). skipNextApply로 재푸시 방지.
src/state/appReducer.ts          # HYDRATE 액션 1개 추가(persisted 4+lang 교체, 트랜션트 보존, 순수). 기존 액션 불변.
src/state/supabase-repository.ts # getMigratedAt/setMigratedAt 2메서드 추가. 기존 메서드 불변.
src/App.tsx                      # <AppProvider><Shell/> → <RepoBoundary><Shell/> 한 줄 교체.
src/i18n/strings.ts              # ko에 migrate* 키 5개 추가.
```

### 변경 금지 — 무변경 확인 (git diff main...HEAD 검증 완료)
```
UNCHANGED: src/domain/**  src/domain/types.ts (CollectedChord 불변)  src/state/mappers.ts
UNCHANGED: src/state/persist.ts (KEYS/PersistedState)  src/state/seed.ts
UNCHANGED: src/lib/supabase.ts  src/auth/AuthGate.tsx  src/test-utils.tsx
```

## 3. 핵심 결정 반영

- **동기 인터페이스 불변 + AsyncRepository 신설(§4.1):** `Repository`/`LocalRepository.loadAll/saveAll` 시그니처
  불변. `AsyncRepository`(loadCached/start/apply/dispose) 별도. AppProvider가 `isAsyncRepository` 가드로 분기.
  주입 없음/동기 repo → 기존 동기 경로 100% 유지 → 회귀 0.
- **HYDRATE(§4.2):** reducer에 유일한 순수 액션 추가. persisted 4+lang만 교체, 트랜션트(view/드래프트/toast/detail) spread 보존.
  `skipNextApply` ref로 HYDRATE 유발 상태변경이 diff→apply로 서버에 재푸시되는 루프를 차단.
- **diff 방식(§5):** action→change 매퍼 대신 prev/next 슬라이스 diff. collected는 **name 자연키 차집합**으로 삭제 산출(index 함정 회피).
- **머지 = 로컬 우선(Q1 확정, §8.4):** grass per-day `max`+합집합, journal/drill/collected/lang **로컬 우선**,
  drill.count `max`(누적/RESET 방어). CollectedChord/도메인 타입에 **updated_at 미추가**. 정밀 LWW는 후속 PR로 이연.
  로컬 낙관 삭제는 `mergePersisted(server, local, pending)`의 pending(큐) delete로 확정(§8.3 3-arg).
- **멱등(AC⑤-5):** push 전부 upsert, 캐시 적용도 자연키 upsert(applyChanges) → change 2회 = 1회. B5-S5 검증.
- **큐 압축(§8.2):** 동일 대상(grass day/journal·drill id/collected name/lang) 최신만 — 효율용(멱등이라 정확성 무관).
- **user-prefix 캐시(§6.2):** `u:{uid}:` + KEYS.*. 큐 `u:{uid}:cs_queue`. 로그아웃 정리는 RepoBoundary key=uid 리마운트 + dispose.
- **마이그레이션(§9.2):** `migrated_at` 서버 플래그 단일 진실. 4분기(≠null/legacy없음→set/legacy있음→모달/가져오기·새로시작).
  seed 오인 방지 위해 legacy 판정/로드는 `seedOnEmpty:false`. legacy 키 보존(롤백 안전).
- **seed 정책(§10):** 인증 유저 캐시 `seedOnEmpty:false`(빈 상태). 로컬 모드 기본 `LocalRepository()`(seed 유지). seed.ts 불변.
- **StrictMode 이중 마운트(R8):** MigrationController `decidedRef`로 판정 1회, SyncRepo `dispose` 멱등·`start` unsub 중복등록 가드.

## 4. 계획 대비 편차 (사유)

1. **`src/state/user-keys.ts` 신설(계획 명시 밖):** 계획 §6.2가 "상수 함수 `userKeyPrefix(uid)`를 두고 공유"를 지시.
   SyncRepo/queue/migration/로그아웃 정리가 공유하므로 별도 헬퍼 모듈로 분리(계획 의도 부합, 순수).
2. **`src/state/apply-changes.ts` 신설:** 계획 §8.5-1 "캐시 즉시 머지: local.saveAll(적용된 patch)"를 구체화한 순수 함수.
   SyncRepo.apply의 낙관적 캐시 갱신을 테스트 1급으로 분리(멱등 자연키 upsert). 계획 파일 맵에 없던 순수 헬퍼.
3. **`mergePersisted`에 3번째 인자 `pending?` 추가:** 계획 §8.4 export는 2-arg(`server,local`)이나, §8.3 prose는
   `merge(server, cache, queuePending)`로 큐 pending을 넘긴다. B5-M5(server-only 포함)와 B5-M6(local 삭제 제외)를
   순수하게 **양립**시키려면 로컬 삭제 근거(큐 pending delete)가 필요 → `pending: RepoChange[] = []` **옵셔널**로 추가.
   2-arg 호출(계획 §8.4 시그니처)도 그대로 성립(합집합만, 삭제 미적용).
4. **`AuthProvider.tsx` 무변경:** 계획 §11이 signOut 캐시/큐 clear를 "(선택) — 또는 RepoBoundary dispose에서"로 명시.
   RepoBoundary `key={uid}` 리마운트 + `SyncRepo.dispose()` + user-prefix 네임스페이스로 다계정 격리가 성립하므로
   AuthProvider는 건드리지 않음(회귀 표면 최소화). **잔여**: 로그아웃 시 이전 user의 localStorage 캐시/큐가 물리적으로
   즉시 삭제되지는 않음(네임스페이스로 노출은 차단됨 — AC⑤-9의 "노출 안 됨"은 만족). 물리 삭제가 필요하면 후속에서
   `userCacheKeys(uid)`(user-keys.ts에 준비됨)로 정리 훅 추가 가능.

## 5. 검증 경계면 B5/B6 매핑 (테스트 정확매칭 — PR④ F1 교훈 반영: 상태 단언 `.toBe`/`.toEqual` 정확매칭)

- **B5-M1~M8** → `src/sync/__tests__/merge.test.ts` (M4=로컬 우선 고정, M7=count max/RESET).
- **B5-Q1~Q4** → `src/sync/__tests__/queue.test.ts` (FIFO/remove/압축/uid 격리).
- **B5-E1~E6** → `src/sync/__tests__/syncEngine.test.ts` (pushChange 정확 인자, flush 부분 실패 잔류).
- **B5-S1~S6** → `src/state/__tests__/sync-repository.test.ts` (loadCached/온라인·오프라인 apply/online flush/멱등/start·dispose).
- **B5-A1~A3** → `src/state/__tests__/AppContext.async.test.tsx` (apply spy/onMerged→HYDRATE/동기 경로 회귀 0).
- **B6-1~3** → `src/sync/__tests__/migration.test.ts`. **B6-4~8** → `src/state/__tests__/MigrationController.test.tsx`.
  **B6-9(가드)** → `src/state/__tests__/RepoBoundary.test.tsx`(local-mode/미인증 → MigrationController 미마운트).

## 6. 잔여 이슈 / 후속

- **정밀 updated_at LWW(Q1 이연):** journal/drill/collected 동시편집 충돌은 현재 로컬 우선. 정밀 LWW는 도메인 타입에
  updated_at을 실어야 하므로(CollectedChord 불변 위배) 후속 PR로 이연(계획 §17-Q1 확정).
- **로그아웃 물리 캐시 삭제:** §4-4 참조. 네임스페이스 격리로 노출은 차단(AC⑤-9 충족), 물리 삭제는 후속 옵션.
- **네이티브 온라인 감지(Q4):** `@capacitor/network`/포그라운드 복귀 flush는 PR⑥ 범위(계획대로 제외).
- **LIVE Supabase 연동:** mock으로 전 경계 검증 완료. 실제 서버 e2e는 사용자 준비물(env) 필요(계획 §12 주석).

## 7. 커밋 이력 (Conventional Commits, feat/sync-engine)
```
feat(sync): RepoChange/QueueItem 타입 + AsyncRepository 인터페이스 (PR⑤-1)
feat(sync): diffChanges — prev/next persisted diff → RepoChange[] (PR⑤-2)
feat(sync): net(isOnline/onOnline) + offline queue with compaction (PR⑤-3,4)
feat(sync): mergePersisted — grass max, union+local-wins, count max (PR⑤-5)
feat(sync): LocalRepository keyPrefix + seedOnEmpty (user cache namespace) (PR⑤-6)
feat(sync): syncEngine + profiles migrated_at (PR⑤-7,8)
feat(sync): SyncRepo (AsyncRepository) — cache+queue+engine, idempotent apply (PR⑤-9)
test(sync): remove unused import in sync-repository test (PR⑤-9 fix)
feat(sync): HYDRATE action + AppProvider async/sync branch (PR⑤-10,11)
feat(sync): migration + Controller/Modal (PR⑤-12,13)
feat(sync): RepoBoundary + App.tsx 배선 (PR⑤-14,15)
test(sync): migrate i18n + MigrationModal 표현 테스트 (PR⑤-16)
```
