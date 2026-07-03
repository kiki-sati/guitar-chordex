# QA 리포트: PR⑤ `feat/sync-engine` — 동기화 엔진 + 로컬→클라우드 마이그레이션

> 정본: `_workspace/17_…plan.md`(설계) · `_workspace/18_…impl.md`(구현)
> 방식: **4-렌즈 적대 검증(qa-verifier ×4 병렬, 전부 READ-ONLY)** + 오케스트레이터 직접 재현(클린 트리, ground truth).
> 결론: **구현은 정확함. 머지 가능(블로킹 0).** 교차 공통 발견 1건(로그아웃 물리 정리)은 4렌즈 만장일치로 **후속 칩**(AC 충족·데이터 유실 없음).

## 1. 오케스트레이터 Ground Truth (클린 트리 직접 실행)

| 항목 | 결과 |
|------|------|
| `npx tsc -b --force` | **exit 0** (진단 스테일 노이즈는 파일 생성 전 스냅샷 — 강제 클린 빌드로 무효 확인) |
| `npx vitest run` (전체) | **298 / 300 pass** — 실패 2건은 기존 무거운 렌더 테스트(`App.smoke` 4뷰 내비 · `DictionaryView` 검색)의 **부하성 5s 타임아웃** |
| 실패 2건 격리 재실행 | **12 / 12 pass, exit 0** (타임아웃났던 케이스 5629ms→1600ms) → **회귀 아님, CI(fresh checkout) 무영향** |
| `npm run build` | **exit 0** |
| 변경금지 8파일 `git diff main..HEAD` | **무변경**(비어있음) — `src/domain/**`·`types.ts`(CollectedChord)·`mappers`·`persist`·`seed`·`lib/supabase`·`AuthGate`·`test-utils` |

> 신규 sync/B5/B6 테스트는 순수/mock 기반이라 부하성 flaky 2건과 무관. 변경 표면: 39파일(+3514/−35), 신규 순수 모듈 + 테스트 다수.

## 2. 렌즈별 판정

| 렌즈 | 판정 | 핵심 근거 |
|------|------|----------|
| ① 머지·멱등 도메인 정확성 | **PASS** | 누적 카운트 **LWW-덮어쓰기 경로가 코드베이스에 부재**(count 쓰기=`merge.ts:66` `Math.max`뿐). grass per-day max 골든 손실 케이스(A오프+3 vs B+2→3) 실제 고정, non-tautological. collected 부활 방지가 pending-delete + pull merge 양쪽 작동(`syncEngine.ts:56-64`). 멱등=upsert 자연키 + flush-후-remove. `pushChange` 8분기 SupabaseRepository 시그니처 1:1. |
| ② 비동기전환·회귀·StrictMode | **PASS** | `isAsyncRepository`(`repository.ts:81`)가 `loadCached` 유무로 판정 — Local/Supabase repo엔 부재 → **오분류 불가, 동기 경로 회귀 0**. HYDRATE(`appReducer.ts:267`) persisted 4+lang만 교체·트랜션트 spread 보존·순수. StrictMode 이중마운트: `if(!this.unsub)` 가드 + dispose null화 → 리스너 순 1개. `skipNextApply`·`firstRun` ref로 오발 apply/재푸시 없음. diff는 index 아닌 name 차집합(`diff-changes.ts:80`). |
| ③ 큐·마이그레이션·vacuity | **PASS** | 오프라인 큐 online-flush가 **false-green 아님**(`start()` 시점 `onLine=false`라 즉시 flush 스킵, 큐 비움은 online 이벤트 리스너뿐). seed 오인 방지=`loadLegacy`가 `seedOnEmpty:false`. 마이그레이션 4분기 각각 실구분(B6-4~8). `initialSync`는 큐 read만(mutate 없음). net.ts SSR 가드. |
| ④ 범위·보안·편차 | **PASS** | 변경금지 무변경 재확인, CollectedChord에 id/updated_at 미추가(Q1 준수). `src/sync/*` React·supabase import 0건, supabase 단일 경유(`RepoBoundary.tsx:29`). 시크릿 0, `package.json` diff 없음(신규 의존성 0). Conventional Commits. 편차 4건 전부 타당. |

## 3. 사용자 확정 결정 준수 (Q1~Q4)

- **Q1 로컬 우선:** journal/drill/collected 동시편집 충돌 시 로컬 유지. **도메인 타입에 `updated_at` 미탑재**(CollectedChord 불변). 정밀 LWW는 후속. 렌즈① 확인.
- **누적 손실 방어(필수):** grass per-day `max`, drill.count `max`. LWW 금지 — 코드·테스트로 완전 보장(B5-M1/M2/M7). 렌즈①③ 교차 확인.
- **Q2 빈→채움**(스켈레톤 없음, `loadCached` 즉시 + `HYDRATE`), **Q3 grass max**, **Q4 web `navigator.onLine`+`online`만**(네이티브는 PR⑥). 준수.

## 4. 교차 공통 발견 — 로그아웃 물리 정리 미구현 (후속 칩, 블로킹 아님)

**발견(렌즈 ①②③④ 전부 관측):** `userCacheKeys(uid)`(`user-keys.ts:19`)·`queue.clear()`가 정의되어 있으나 **프로덕션 호출부 없음**. `SyncRepo.dispose()`는 online 리스너만 해제, `AuthProvider.signOut`도 정리 훅 없음. 로그아웃 후 이전 user의 `u:{uid}:cs_*` 캐시/큐가 localStorage에 물리 잔존.

**4렌즈 만장일치 판정 = 블로킹 아님:**
- **AC⑤-9("다른 계정 로그인 시 이전 유저 데이터 노출 안 됨") 충족.** account 전환은 `RepoBoundary key={uid}` 완전 리마운트 + `u:{uid}:` 네임스페이스로 격리 — B의 repo가 A의 키를 **읽는 코드 경로 자체가 없음**. `hasLegacyData/loadLegacy`도 bare `cs_*`(legacy)만 읽어 A 네임스페이스를 오인하지 않음.
- **계획 §11이 signOut 정리를 "(선택) — 또는 RepoBoundary dispose에서"로 명시 옵션화** → 계약 위반 아님.
- 데이터 유실/오작동 없음(재로그인 시 stale 캐시는 initialSync의 서버 pull + grass max/합집합 merge로 덮임). 정리 재료(`userCacheKeys`)는 이미 준비됨.

**잔여 위험(실질):** 공유 기기(도서관/PC방) localStorage에 이전 유저 연습기록 평문 잔존 — 앱 UI로는 비노출, devtools로는 조회 가능.
**권고:** 후속 칩으로 `signOut`(또는 이전 uid `dispose` 경로)에서 `userCacheKeys(prevUid)`로 `localStorage.removeItem` 정리. **공유 기기 프라이버시를 명시 위협모델로 삼으면 우선순위 상향**(사용자 판단).

## 5. Minor 관찰 (전부 비블로킹)

| # | 관찰 | 판정 |
|---|------|------|
| O2 | `mergePersisted(server, local, pending?=[])` 3-arg — 계획 §8.4 export는 2-arg | 무해. 계획 §8.3 **prose와 일치**, 삭제 유실 방지로 **구현이 더 정확**. 2-arg 호출 하위호환. |
| O3 | drill.count 순수 `max` — 서버 count가 큰 오래된 값이면 로컬 RESET(0)을 삼킴 | Q1 수용 트레이드오프. **누적 손실 방향 아님**(카운트 커지는 쪽), 데이터 유실 아님. 정밀 LWW는 후속. |
| O4 | `crypto.randomUUID()` 미가드(`sync-repository.ts:99`) | `apply`(클라 런타임 전용, SSR 미도달) 내부만. web+Capacitor WebView+Node18 전부 제공 → 스코프상 안전. |
| O5 | 로그아웃 물리정리 이연을 고정하는 **테스트 없음**(격리는 prefix 단위 테스트로만 간접 보장) | 후속 칩에 정리 훅 + 테스트 동반 권고. |

## 6. 경계면 정합성 (교차 비교 — 생산자↔소비자)

- **grass 절대값 계약 6단 일관:** `diffChanges`(count=after) → 큐 `targetKey grass:day` → `applyChanges`(grass[day]=count) → `mergePersisted` per-day max → `pushChange saveGrass({[day]:count})` → 서버 upsert `(user_id,day)`. LWW 오염 없음, 누적 손실 방어(R5).
- **`pushChange`↔`SupabaseRepository` 8메서드 시그니처 1:1** (saveGrass/upsert·deleteJournal/upsert·deleteDrill/upsert·deleteCollected/setLang). 자연키(drill sortOrder·collected name) 준수.
- **미검증(스코프):** LIVE Supabase e2e는 사용자 준비물(계획 §12) — mock으로 전 경계 대체. RLS는 PR③ 완료분 재사용.

## 7. 결론

PR⑤는 정확하고 CI-안전하다. 동기→비동기 전환의 회귀 표면이 `isAsyncRepository` 가드로 격리되고, 누적 카운트 손실 방지(핵심 요구)가 코드·테스트로 완전 보장되며, 멱등·마이그레이션 1회성·오프라인 큐가 정확하다. 골든 케이스는 tautological/false-green이 아니다. **블로킹 0 → 자동 머지 게이트(`Build & Test (web)`) 통과 가능.** 로그아웃 물리 정리는 별도 후속 칩으로 분리.

## 8. 교훈(하네스 운영)

이번 QA는 **4렌즈 전부 READ-ONLY**로 띄우고 ground truth(tsc/test/build/변경금지)는 클린 트리에서 오케스트레이터가 직접 재현 — PR④의 자기유발 오염(단일 트리 동시 변이)을 회피. 소스를 편집하는 렌즈가 하나도 없어 상호 오염 0, 판정 결정적. (메모리: `qa-workflow-mutation-isolation` 준수 확인.)
