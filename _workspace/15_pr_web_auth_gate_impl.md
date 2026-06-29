# 구현 로그: PR④ `feat/web-auth-gate` — 웹 인증 + 로그인 게이트

> 설계 정본: `_workspace/14_pr_web_auth_gate_plan.md`
> 브랜치: `feat/web-auth-gate` (base: main @ `1a8534f`, PR #10 머지 포함)
> 비고: 구현 에이전트가 산출물 작성 직전 프로세스 종료로 중단됨 → 오케스트레이터가 디스크에 남은 결과를 **직접 검증·리뷰**하고 본 로그를 작성. 코드는 완성 상태.

## 1. 산출물 (파일 맵)

### 신규 (new)
| 파일 | 역할 |
|------|------|
| `src/auth/AuthProvider.tsx` | 세션 컨텍스트(`AuthStatus` 4상태) + `signIn*/signOut` 메서드 + `useAuth()` 훅. **supabase.auth를 만지는 유일한 곳.** |
| `src/auth/AuthGate.tsx` | 순수 4-분기 게이트(`loading/unauthenticated/authenticated/local-mode`) + `AuthSplash` |
| `src/auth/LoginScreen.tsx` | Google/Apple OAuth 버튼 + 이메일 매직링크 폼(클라 형식검증·a11y) |
| `src/auth/LoginScreen.module.css` | 로그인 화면 스타일 (tokens.css만 사용) |
| `src/auth/AuthGate.module.css` | 스플래시 스타일 (tokens.css만 사용) |
| `src/auth/__tests__/AuthProvider.test.tsx` | getSession 분기·구독/정리·메서드 위임·local-mode no-op |
| `src/auth/__tests__/AuthGate.test.tsx` | 게이트 7케이스(§5.2) |
| `src/auth/__tests__/LoginScreen.test.tsx` | OAuth/이메일 5케이스(§5.3) |
| `src/components/__tests__/Sidebar.test.tsx` | **신규** — 로그아웃 버튼(authenticated 노출 / local-mode 숨김) |
| `src/i18n/__tests__/strings.auth.test.ts` | login*/logout 키 존재·shape |

### 변경 (changed)
| 파일 | 변경 |
|------|------|
| `src/main.tsx` | `<App/>` → `<AuthProvider><AuthGate><App/></AuthGate></AuthProvider>` (StrictMode 내부). 그 외 불변. |
| `src/components/Sidebar.tsx` | `useAuth()` 추가, 푸터에 로그아웃 버튼(`status==='authenticated'`일 때만) |
| `src/components/Sidebar.module.css` | `.logoutBtn` (+hover) — 토큰 사용 |
| `src/i18n/strings.ts` | `ko`에 `login*`/`logout` 13키 추가 (**ko 전용**, EN은 후속 i18n PR) |

### 변경 금지 준수 (touched: NO) — 회귀 0의 축
`src/App.tsx` · `src/state/AppContext.tsx`(동기 `loadAll` 유지) · `repository.ts` · `local-repository.ts` · `supabase-repository.ts`(미배선 유지 → PR⑤) · `src/lib/supabase.ts` · `src/test-utils.tsx`(`renderWithProvider` 불변).

## 2. 핵심 결정 (설계 §의 확정 반영)

1. **`useAuth()` 관대 폴백(§3.3-A):** Provider 부재 시 throw하지 않고 `LOCAL_MODE_DEFAULT`(no-op) 반환. → 기존 테스트(인증 mock 없음)·`renderWithProvider`가 게이트 없이도 동작, 로그아웃 버튼은 local-mode라 미렌더 → **시각/단언 회귀 0**. (`useApp()`는 여전히 throw — 의도적 비대칭.)
2. **유일한 신규 비동기 = 세션 확인.** `getSession()` + `onAuthStateChange`는 `AuthProvider` effect에만. `AppProvider`는 동기 `LocalRepository.loadAll()` 그대로. `Repository.load` async 승격 안 함(= PR⑤ 영역).
3. **AC-11 안티-브릭:** `isSupabaseConfigured===false`면 effect early-return(=`supabase`(null) 절대 역참조 안 함), 게이트는 children 직접 렌더. env 없으면 로컬 모드로 앱 정상.
4. **로그아웃 위치 = Sidebar 푸터.** Header(props-only, `.logBtn` "기록" 점유)와 라벨 충돌 회피. authenticated일 때만 렌더.
5. **계층 분리:** supabase SDK 호출은 `AuthProvider` 1곳. `LoginScreen`/`Sidebar`는 `useAuth()` 메서드만.
6. **AuthSplash 디자인 정본 부재** → tokens.css 기반 미니멀(🎸+브랜드+스피너).

## 3. 검증 결과 (오케스트레이터 직접 실행 — ground truth)

| 항목 | 결과 |
|------|------|
| `npx tsc -b` | **exit 0** |
| `npm test` (CI 동등 — `.claude` 워크트리 제외) | **24 파일 / 187 테스트 전부 통과, exit 0** (PR③ 158 → +29 신규) |
| `npm run build` (tsc -b && vite build) | **exit 0** (142 모듈, dist 생성) |
| CSS 토큰 정합 | 신규 CSS가 쓴 토큰 17종 전부 `tokens.css`에 정의됨(미정의 0) |
| 변경 금지 파일 | git diff상 무변경 확인 |

> **로컬 주의(PR④ 무관):** 저장소에 이전 세션의 stale `.claude/worktrees/*`가 남아 vitest가 중복 수집 → 풀 실행 시 587 테스트로 부풀고 워크트리 복사본에서 flaky 5s 타임아웃 1건 발생. CI는 fresh checkout이라 영향 없음. 워크트리 exclude는 별도 PR(`chore/vitest-exclude-claude` 칩) 영역 — PR④에 섞지 않음.

## 3b. QA 반영 수정 (4-렌즈 적대 검증 후 — 상세 `_workspace/16`)

- **F1 (테스트 정확매칭):** `AuthProvider.test.tsx`의 상태 단언을 `toHaveTextContent('authenticated')`(substring — `'unauthenticated'`가 false-통과) → `.textContent).toBe('authenticated')` 정확매칭으로 교체(2곳). 이제 세션 무시 변이를 단위테스트 레벨에서도 잡는다.
- **F2 (레이스 가드):** `AuthProvider.tsx` effect에 `settledByEvent` 플래그 추가 — `onAuthStateChange`가 먼저 발화하면 늦게 resolve되는 `getSession` 결과로 더 최신 세션을 덮어쓰지 않는다(순서 역전 차단). 테스트 전부 그린 유지.
- **분리(별도 PR):** vitest `.claude/worktrees/**` 미제외로 인한 로컬 중복 수집은 PR④ 범위 밖(CI fresh checkout 무영향) → 기존 `chore/vitest-exclude-claude` 칩이 담당.

## 4. 사용자 사전 준비물 (LIVE 로그인 시점 — 코드/테스트는 지금 검증 완료)

- 이메일 매직링크 = 가장 마찰 적은 경로(Supabase 이메일만 켜면 됨).
- Google: §9.2 / Apple: §9.3 / Supabase Auth URL: §9.4.
- PR③ 후속: `0001_init.sql` 적용 + `.env`의 `VITE_SUPABASE_ANON_KEY`를 `sb_publishable_…`로 교체.
