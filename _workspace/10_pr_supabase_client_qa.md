# QA 리포트 — PR② feat/supabase-client (독립 검증)

- 검증 기준: `_workspace/05_backend_auth_plan.md` §4.2 / AC-11 / §10(S1·S2) / §8 범위
- 검증 대상 상태: 브랜치 `feat/supabase-client` (base `bc3f317` = origin/main). **변경은 아직 커밋되지 않은 워킹트리 상태**(tracked: `package.json`/`package-lock.json`/`src/vite-env.d.ts` 수정, untracked: `.env.example`/`src/lib/supabase.ts`/`src/lib/__tests__/supabase.test.ts` 신규).
- 검증 일시: 2026-06-29
- 검증자: qa-verifier (integration-qa 원칙 — 양쪽 동시 읽기 / 명령 직접 재실행)

## 종합 판정: PASS_WITH_NOTES

기능·경계면·도메인·빌드/테스트 모두 통과. 차단 이슈 0건. **비차단 주의 2건**(로컬 `.env`에 잘못된 키 종류, Vitest 워크트리 중복 카운트 — 둘 다 커밋 산출물 밖의 환경 이슈).

---

## 재실행 출력 (env VITE_SUPABASE_* 부재 — 워킹트리 `.env`를 검증 중 일시 격리 후 복원)

> 주의: 워킹트리에 실제 `.env`(09:46 생성)가 존재해 Vite/Vitest가 자동 로드한다. "env 부재" 요구를 정확히 충족하기 위해 검증 동안 `.env`를 `.env.qabak`로 이동(env 진짜 부재 보장)한 뒤 검증 종료 시 원위치 복원했다. `git status`로 워킹트리가 검증 전과 동일함을 확인.

| 명령 | exit code | 결과 |
|------|-----------|------|
| `npx tsc -b` | **0** | `TSC_EXIT=0` (타입 그린, strict) |
| `npm run build` (tsc -b → vite build) | **0** | `✓ 92 modules transformed` / `✓ built in 4.05s` / `BUILD_EXIT=0` |
| `npm test` (vitest run, 원시) | **0** | `Test Files 33 passed (33)` / `Tests 249 passed (249)` — 단, 아래 N2(워크트리 중복)로 과대 카운트 |
| `npx vitest run --exclude '**/.claude/**'` (단일 트리 실측) | **0** | `Test Files 17 passed (17)` / `Tests 128 passed (128)` |
| 신규 `src/lib/__tests__/supabase.test.ts` | **0** | **7 passed** (단일 파일 실행 재확인 동일) |

- 실측 테스트 파일 수 = **17**, 통과 = **128**. PR② 신규 = **7/7 통과**.
- 33/249는 `.claude/worktrees/relaxed-swanson-363852/`가 트리에 중복 존재해 Vitest가 두 번 수집한 결과(PR② 결함 아님 — N2 참조).

---

## 경계면 / 정합성 교차검증 표

| # | 경계면 (생산자 ↔ 소비자) | 기준 | 결과 | 근거 |
|---|---------------------------|------|------|------|
| B1 | `supabase.ts` ↔ 계획 §4.2 코드 블록 | url/anon = `import.meta.env.*`, `isSupabaseConfigured=Boolean(url&&anon)`, `supabase=구성시 createClient(url!,anon!,{auth})·아니면 null` | PASS | `src/lib/supabase.ts:7-8,26,34-46` — §4.2 레퍼런스와 **줄 단위 일치(verbatim)** |
| B2 | auth 옵션 | `flowType:'pkce'`, `autoRefreshToken:true`, `persistSession:true`, `detectSessionInUrl=!isNative`, `storage=isNative?어댑터:undefined` | PASS | `supabase.ts:37-43` 5개 옵션 전부 §4.2와 일치 |
| B3 | `nativeStorage` 어댑터 shape | `getItem/setItem/removeItem` async, Preferences 위임 | PASS | `supabase.ts:12-20` 계획 §4.2 어댑터와 동일 |
| B4 | env 타입 선언 ↔ 사용 | `ImportMetaEnv.VITE_SUPABASE_*?: string` | PASS | `src/vite-env.d.ts:3-6` optional 선언, `supabase.ts`의 `string\|undefined` 사용과 정합 |
| B5 (AC-11) | env 부재 graceful | import 크래시 0 / `isSupabaseConfigured=false` / `supabase=null` / `createClient` 미호출 | PASS | 테스트 `supabase.test.ts:31-59` 4케이스 + 실측 env 부재 build/test exit 0 |
| B6 (AC-11) | env 설정 분기 | `isSupabaseConfigured=true` / `supabase≠null` / `createClient` 1회 url·anon·PKCE로 호출 | PASS | 테스트 `supabase.test.ts:62-90` 3케이스 — **양쪽 분기 실제 커버** |
| B7 | `url`만 있고 `anon` 없음 | 미설정 취급(빈문자열 falsy) | PASS | `supabase.test.ts:53-59` + `Boolean(url&&anon)` 단락평가 |
| B8 | 신규 의존성 | `@supabase/supabase-js`, `@capacitor/preferences` **딱 2개**만 추가, 그 외 런타임 의존성 0 | PASS | `package.json` diff = `+@capacitor/preferences ^8.0.1`, `+@supabase/supabase-js ^2.108.2` (devDep·제거 없음); lock에 `@supabase/*` 전이 의존성만 |
| B9 | 범위 격리 | `src/domain/**`, `appReducer.ts`, `components`/`views`, `*.css`, `capacitor.config.ts` 무변경 | PASS | 워킹트리 변경 목록 grep → 해당 경로 0건 ("CLEAN") |
| B10 | 타입 안전성 | `any`/강제 캐스팅 남용 0, `storage as never` 1곳만 허용, strict 그린 | PASS | `supabase.ts`의 `as` = `nativeStorage as never` 1곳(§4.2 설계), 테스트 캐스팅 0, `tsc -b` exit 0 |

### AC-11 분기 커버리지 (양쪽 실제 덮음 확인)
- 미설정 분기: `supabase.test.ts` 31·38·45·53행 — import 무크래시 / `false` / `null` & `createClient` 미호출 / url-only=미설정. (createClient `vi.mock` → 네트워크 0)
- 설정 분기: `supabase.test.ts` 68·73·78행 — `true` / `≠null` / `createClient` 1회 + url·anon·PKCE·detectSessionInUrl=true·storage=undefined 검증.
- 테스트는 `vi.stubEnv` + `vi.resetModules` + 동적 import로 hermetic — 앰비언트 `.env` 유무와 무관하게 통과(`.env` 존재 상태에서도 7/7 재확인).

---

## 보안 (§10 S1·S2) — PASS

- **커밋 대상 콘텐츠에 실제 키/`service_role` 노출 0.** `git diff bc3f317` + 신규파일 전체를 스캔 → `service_role`은 `.env.example`의 *금지 경고 문서*에서만, `supabase.co`는 테스트 픽스처(`https://example.supabase.co`)에서만 출현.
- **`.env`는 git-ignore됨** — `git check-ignore -v .env` → `.gitignore:28 .env`. 워킹트리의 실제 `.env`는 커밋 diff에 들어가지 않음.
- `.gitignore` 유지 확인(27-30행): `.env` / `.env.*` 제외, `!.env.example` 허용.
- `.env.example` 값은 비어 있음(`VITE_SUPABASE_URL=` / `VITE_SUPABASE_ANON_KEY=`), service_role 미사용 명시.

---

## 도메인 정확성 — N/A (해당 없음)

PR②는 인프라(클라이언트 구성) 작업으로 코드/보이싱/프렛/스케일 도메인 데이터를 다루지 않는다. `src/domain/**` 무변경 확인(B9).

---

## 차단 이슈

없음.

---

## 비차단 이슈 / 주의

- **N1 (보안 위생 — 로컬 한정, 커밋 산출물 외):** 워킹트리 `.env`의 `VITE_SUPABASE_ANON_KEY` 값이 `sb_secret_...` 접두사다. `sb_secret_`는 Supabase **secret(서버) 키** 형식으로, 클라이언트에 노출되는 `anon public` 키 자리에 들어갈 키 종류가 아니다. `.env`는 git-ignore되어 **커밋/푸시되지 않으므로 차단은 아니다**. 다만 (1) 키 종류가 잘못됐고(anon이 아니라 secret), (2) Vite는 `VITE_` 접두사 env를 클라이언트 번들에 인라인하므로 이 값으로 실제 `npm run dev`/`build`를 돌리면 secret 키가 프론트엔드 번들에 박힌다. 권장: 로컬 `.env`를 실제 **anon public** 키로 교체하고, 이미 노출된 `sb_secret_...` 키는 Supabase 대시보드에서 **즉시 폐기/회전(rotate)**. (구현 코드 결함 아님 — 개발자 로컬 설정 문제)
- **N2 (테스트 환경 — 중복 카운트):** `.claude/worktrees/relaxed-swanson-363852/`(브랜치 `claude/relaxed-swanson-363852`)가 메인 트리 내부에 존재해 `npm test`가 동일 테스트를 두 번 수집(33파일/249테스트로 과대 보고). 실측 단일 트리 = 17파일/128테스트. PR② 결함 아님이며, 구현자가 정리용 백그라운드 작업(task_b424970e)으로 이미 분리 플래그함. 권장: 해당 stale 워크트리 제거 또는 `vitest.config`에 `.claude/**` exclude 추가.
- **N3 (절차 — 정보):** PR② 변경이 아직 커밋되지 않은 워킹트리 상태다. `git diff origin/main...HEAD`는 빈 결과를 반환하므로(커밋 전), 본 검증의 범위/diff 판단은 **워킹트리 변경(tracked diff + untracked 신규파일)** 기준으로 수행했다. 커밋 시 `_workspace/07_pr_repository_abstraction_qa.md`(무관한 선존 untracked 파일)가 함께 staged되지 않도록 주의.

---

## 미검증

- 모바일(네이티브) 분기 런타임 동작(`Capacitor.isNativePlatform()===true`에서 Preferences 어댑터 실제 동작): 웹 단위테스트 환경에서는 비네이티브 경로만 실행됨. 네이티브 storage 어댑터 실동작은 후속 PR(§4.4 딥링크/세션) 또는 디바이스 검증 대상. 본 PR 범위(§8)에서는 계획상 미요구.
