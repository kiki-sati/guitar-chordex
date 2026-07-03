# 후속 칩: 로그아웃 캐시/큐 물리 정리 (PR⑤ 후속)

> 근거: `_workspace/19_pr_sync_engine_qa.md` §4 (4-렌즈 만장일치 후속 관측) · 계획 `17_…plan.md` §11.
> 브랜치: `feat/logout-cache-cleanup`. 스코프: 공유기기 프라이버시(도서관/PC방 localStorage 평문 잔존 제거).

**문제.** PR⑤까지 `userCacheKeys(uid)`·`queue.clear()`는 정의됐으나 프로덕션 호출부가 없어, 로그아웃 후에도 이전 user의 `u:{uid}:cs_grass|journal|drills|collected|lang` + `u:{uid}:cs_queue`가 localStorage에 물리 잔존했다. AC⑤-9의 "노출 안 됨"은 `RepoBoundary key={uid}` 리마운트 + `u:{uid}:` 네임스페이스로 이미 충족(다른 계정이 이전 키를 읽는 경로 자체가 없음). 남은 위험은 **노출이 아니라 물리 잔존**(devtools 평문 조회 가능) — 공유기기 프라이버시.

**설계 결정 — 정리 위치: `AuthProvider.signOut` (계획 §11 "택1").**
- signOut은 **명시적 로그아웃**(위협모델의 정확한 트리거)에서만 발화하고, 메모된 `session`으로 직전 uid를 바로 안다.
- `RepoBoundary key={uid}` 리마운트 격리를 건드리지 않는다(제약 2 준수).
- `SyncRepo.dispose()`는 **부적합**: StrictMode 이중마운트를 포함한 모든 AppProvider 언마운트에서 호출되어 라이브 캐시를 지워버린다(정상 운용 중 데이터 유실). → dispose 경로 기각.

**구현.**
- `src/state/user-keys.ts` — `clearUserCache(uid)` 신규(순수·React 무의존, 단위 테스트 1급). `userCacheKeys(uid)`(이미 큐 키 포함)를 순회하며 `localStorage.removeItem`, try/catch 가드(private mode/quota/SSR). `userCacheKeys`에 큐 키가 포함되므로 별도 `queue.clear()` 불필요 — 이 한 루프가 캐시+큐 모두 제거.
- `src/auth/AuthProvider.tsx` — `signOut`: `const prevUid = session?.user?.id ?? null; await supabase.auth.signOut(); if (prevUid) clearUserCache(prevUid);`. `if (!supabase) return`(로컬 모드) + `if (prevUid)`(미인증) 이중 가드로 **회귀 0**.

**회귀 0 근거.**
- 로컬 모드(`supabase===null`): signOut이 `if (!supabase) return`으로 조기 종료 → clearUserCache 미호출, localStorage 무영향.
- 미인증(`prevUid===null`): `if (prevUid)` 가드로 removeItem 미실행.
- `clearUserCache`는 `u:{uid}:*`만 대상 → legacy bare `cs_*`·다른 uid `u:{other}:*` 불변(다계정 격리·로컬 seed 경로 유지).

**테스트(QA O5 해소 — 이연을 고정하는 테스트 신설).**
- `src/state/__tests__/user-keys.test.ts`(신규): 키 파생 + `clearUserCache`가 (a) 대상 uid 캐시+큐 전부 삭제, (b) legacy `cs_*` 불변, (c) 다른 uid 네임스페이스 불변. 삭제 전 존재→삭제 후 null 관측(non-tautological).
- `src/auth/__tests__/AuthProvider.test.tsx`(+3): 인증 상태 signOut이 `u:u1:*` 물리 삭제 / 다른 uid·legacy 불변 / 미인증 signOut은 storage no-op.

**검증(오케스트레이터 직접 재현, 클린).**
- `npx tsc -b` → exit 0
- `npx vitest run` → **308/308 pass** (41 파일, 기존 flaky 2건도 이번 런 통과, 회귀 0)
- `npm run build` → exit 0

**독립 QA:** qa-verifier 서브에이전트 READ-ONLY 적대 검증(메모리 `qa-workflow-mutation-isolation` 준수 — 소스 변이 렌즈 0).
