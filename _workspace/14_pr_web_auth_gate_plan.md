# 설계: PR④ `feat/web-auth-gate` — 웹 인증 + 로그인 게이트

> 산출물: `_workspace/14_pr_web_auth_gate_plan.md`
> 대상: implementer(즉시 착수), qa-verifier(검증 경계면)
> 정본: `_workspace/05_backend_auth_plan.md` §4.1·§4.2·§4.3·§4.5·§4.6, §8 PR④, AC-1/AC-2/AC-11, B2. + `CLAUDE.md`(계층/CSS Modules/시크릿/PR 규칙).
> **이 PR이 통합하는 실제 코드를 기준으로 설계**한다(플랜 §5 스케치의 `LocalRepo`/`repo.load()`/비동기 가정과 다름 — 아래 §0 참조).

## 0. 현실(현 코드) vs 정본 스케치 — 차이 고정

정본 §4.5·§5는 `repo.load()`(async)·`LocalRepo` 같은 미래형 이름을 쓴다. **PR④는 현재 머지된 코드와 통합**하므로 아래 사실을 단일 기준으로 삼는다.

| 항목 | 현 코드(사실) | 비고 |
|---|---|---|
| 진입 트리 | `main.tsx` → `<StrictMode><App/></StrictMode>`, 그 후 `void initNative()` | `App.tsx`의 `export function App()` = `<AppProvider><Shell/></AppProvider>` |
| 영속 추상화 | `src/state/repository.ts` `interface Repository` | **`loadAll(): PersistedState` (동기)** · `saveAll(patch)` 동기 |
| 기본 repo | `new LocalRepository()` (`src/state/local-repository.ts`, 인자 없는 생성자) | `AppProvider({children, repository?})`가 미주입 시 사용 |
| 초기화 | `useReducer(reducer, undefined, () => initState(repo.loadAll()))` | **동기 lazy init** — PR④는 그대로 둔다 |
| Supabase | `src/lib/supabase.ts` → `supabase: SupabaseClient | null`, `isSupabaseConfigured: boolean` | env 없으면 `supabase===null`, `isSupabaseConfigured===false` |
| SupabaseRepository | `src/state/supabase-repository.ts` 존재하나 **미배선**(async, 독립) | **PR④에서 배선 금지** — repo 교체/동기화는 PR⑤ |
| 소비자 훅 | `useApp()` → Shell·Sidebar가 사용 | 로그아웃 버튼은 이 트리 안에 둔다 |

**핵심 경계 결정(정본 §8 PR④ 범위 + 사용자 지시 §4-async-init):**
PR④가 도입하는 **유일한 비동기**는 **세션 확인**(`supabase.auth.getSession()` + `onAuthStateChange`)이며, 이는 `AuthProvider`/`AuthGate`에만 산다. **`AppProvider`는 동기 그대로**(`LocalRepository.loadAll()`) 유지한다. `Repository.load`를 async로 승격하지 않는다 — 그것은 SupabaseRepo/SyncRepo가 배선되는 **PR⑤** 작업이다. 이렇게 분리해야 (a) 기존 158 테스트 회귀 0, (b) AC-11 로컬 전용 모드 무손상, (c) PR 단위 최소성이 동시에 성립한다.

---

## 1. 수용 기준 (Acceptance Criteria) — 모두 테스트 관측 가능

각 AC는 RTL(mock `supabase.auth`)로 관측 가능하게 진술한다. 정본 AC-1/AC-2/AC-11 + B2 + 로그아웃에 매핑.

- [ ] **AC④-1 (정본 AC-1 · 게이트):** `isSupabaseConfigured === true` & 세션 없음일 때 `AuthGate`는 `LoginScreen`만 렌더하고 `AppProvider`/`Shell` 하위(예: Sidebar 브랜드 텍스트, Header)는 **마운트되지 않는다**. [QA: 라우팅 게이트]
- [ ] **AC④-2 (정본 AC-2 · 로그인 전이):** 세션이 생기면(`onAuthStateChange`가 `SIGNED_IN` 발화 또는 `getSession`이 세션 반환) 게이트가 사라지고 `Shell`(본 화면)이 렌더된다. [QA: 게이트 분기]
- [ ] **AC④-3 (정본 B2 · 세션 영속):** 초기 마운트 시 `getSession()`이 기존 세션을 반환하면 `LoginScreen` 없이 곧장 `Shell`이 렌더된다(=새로고침/재마운트 후 로그인 화면 재노출 없음). [QA: B2]
- [ ] **AC④-4 (정본 AC-2 · OAuth 메서드):** `LoginScreen`의 "Google로 계속" 클릭 → `supabase.auth.signInWithOAuth({provider:'google', options:{redirectTo: window.location.origin}})` 1회 호출. "Apple로 계속" → 동일 형태 `provider:'apple'`. [QA: 메서드 계약]
- [ ] **AC④-5 (이메일 매직링크):** 이메일 입력 후 제출 → `supabase.auth.signInWithOtp({email, options:{emailRedirectTo: window.location.origin}})` 1회 호출, 성공 시 "메일을 확인하세요" 안내가 노출된다. 빈/형식오류 이메일은 호출하지 않고 검증 메시지를 보인다. [QA: 메서드 계약]
- [ ] **AC④-6 (로그아웃):** 인증 상태에서 로그아웃 컨트롤 클릭 → `supabase.auth.signOut()` 1회 호출. `SIGNED_OUT` 발화 시 게이트가 다시 `LoginScreen`을 렌더한다. [QA: B2]
- [ ] **AC④-7 (정본 AC-11 · 로컬 전용 모드 — 앱을 벽돌로 만들지 않음):** `isSupabaseConfigured === false`(env 없음, CI 포함)일 때 `AuthGate`는 **`supabase.auth`를 호출하지 않고**(=null 역참조 크래시 없음) children을 **그대로 렌더**한다(로그인 벽 없음). 기존 158 테스트 + `npm run build` 그린. [QA: 로컬 모드 폴백]
- [ ] **AC④-8 (로딩 스플래시):** 세션 확인(`getSession` Promise) 미완료 동안 `AuthGate`는 `loading` 스플래시를 렌더한다(로그인 화면도 본 화면도 아님). 확인 완료 후 한 번만 전이한다. [QA: 게이트 분기]
- [ ] **AC④-9 (구독 정리):** `AuthProvider` 언마운트 시 `onAuthStateChange` 구독이 해제된다(`subscription.unsubscribe()` 호출). [QA: 누수 방지]
- [ ] **AC④-10 (회귀 0):** PR④ 머지 후 `npm test`(기존 158) + `npm run build` 그린. 뷰/리듀서/도메인 테스트 무변경. [QA: 회귀]

> **범위 밖(명시) — 이 AC들은 PR④가 검증하지 않는다:** 데이터 동기화(AC-3/4/5), RLS(AC-6), 마이그레이션 모달(AC-7), 충돌 머지(AC-10), 네이티브 인증(AC-9). 로그인 후 `AppProvider`는 **여전히 `LocalRepository`**를 쓴다(데이터는 로컬). repo 교체는 PR⑤.

---

## 2. 컴포넌트 설계 (props / state / 계약)

신규 레이어: `src/auth/`. 정본 §4.5 트리(`AuthProvider → AuthGate → AppProvider → Shell`).

### 2.1 `AuthProvider` — 세션 상태 + 로그인 메서드 컨텍스트

세션 단일 출처. `supabase.auth`를 직접 만지는 유일한 곳(외부에 메서드만 노출). 로컬 모드(`isSupabaseConfigured===false`)에서는 `supabase`가 null이므로 **auth API를 호출하지 않고** 즉시 "로컬 모드" 컨텍스트를 제공한다.

**컨텍스트 값 shape (계약 — 사용자 지시 그대로):**
```typescript
// src/auth/AuthProvider.tsx
import type { Session } from '@supabase/supabase-js';

export type AuthStatus =
  | 'loading'          // getSession in-flight
  | 'unauthenticated'  // configured, 세션 없음
  | 'authenticated'    // configured, 세션 있음
  | 'local-mode';      // isSupabaseConfigured === false (env 없음)

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;       // local-mode/unauthenticated에서는 null
  loading: boolean;              // status === 'loading' 의 편의 별칭
  /** OAuth 리다이렉트 시작. local-mode/null client에서는 no-op(또는 거부). */
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  /** 매직링크 OTP 발송. 성공 여부/에러를 호출자가 UI로 처리할 수 있게 결과 반환. */
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}
```

**props:** `{ children: ReactNode }`. 테스트 주입을 위해 클라이언트는 모듈 import(`supabase`, `isSupabaseConfigured`)를 사용한다(테스트는 `vi.mock('../lib/supabase', ...)`로 주입 — §5). *주입 prop은 두지 않는다*(현 코드 컨벤션·플랜 일관, mock으로 충분).

**내부 상태/효과:**
- 초기 `status`: `isSupabaseConfigured ? 'loading' : 'local-mode'`.
- `useEffect`(configured일 때만):
  1. `supabase!.auth.getSession()` → 세션 유무로 `authenticated`/`unauthenticated` 전이(언마운트 후 setState 가드 `let active=true`).
  2. `const { data:{ subscription } } = supabase!.auth.onAuthStateChange((_event, session) => { setSession; setStatus })` 구독. cleanup에서 `subscription.unsubscribe()` + `active=false`. (AC④-9)
- 메서드 구현(§정본 4.1/4.3):
  - `signInWithGoogle`: `supabase!.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin } })`.
  - `signInWithApple`: 동일 `provider:'apple'`.
  - `signInWithEmail(email)`: `supabase!.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.origin } })` → `{ error }` 정규화 반환.
  - `signOut`: `supabase!.auth.signOut()`.
  - **local-mode 가드:** `supabase`가 null이면 OAuth/signOut은 no-op(예외 던지지 않음), `signInWithEmail`은 `{ error: new Error('local mode') }` 반환. (이 경로는 로컬 모드에서 UI상 도달 불가지만 방어.)
- `useAuth()` 훅 export(컨텍스트 없으면 throw — 현 `useApp` 패턴 동일).

> **결정: 세션 출처 일원화.** `getSession()`과 `onAuthStateChange` **둘 다** 구독한다. `onAuthStateChange`는 초기 세션도 발화할 수 있으나, 명시적 `getSession()`로 초기 1회를 확정해 `loading→authenticated/unauthenticated` 전이를 결정한다(스플래시 종료 트리거). 이후 전이는 구독이 담당.

### 2.2 `AuthGate` — 상태 머신(로컬 모드 포함)

`useAuth().status`만 읽어 4-갈래로 분기하는 **순수 분기 컴포넌트**(자체 effect 없음 → 테스트 단순).

| status | 렌더 |
|---|---|
| `loading` | `<AuthSplash/>`(로딩 스플래시 — 로고/스피너, 본 화면도 로그인도 아님) |
| `unauthenticated` | `<LoginScreen/>` |
| `authenticated` | `{children}` (= `<AppProvider><Shell/></AppProvider>`) |
| `local-mode` | `{children}` **그대로** (로그인 벽 없음 — AC④-7) |

```typescript
// src/auth/AuthGate.tsx
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <AuthSplash />;
  if (status === 'unauthenticated') return <LoginScreen />;
  return <>{children}</>; // authenticated | local-mode
}
```
> `local-mode`와 `authenticated`가 같은 분기(children)인 게 **AC-11의 본질**: env 없으면 로그인 없이 앱이 정상 동작. `AuthGate`는 이 둘을 구분할 필요가 없다.

### 2.3 `LoginScreen` — OAuth 버튼 + 이메일 매직링크 폼

`useAuth()`의 메서드를 호출하는 프레젠테이션. **CSS Modules + tokens.css**로 디자인 토큰 재현(인라인 스타일 프로토타입 복사 금지 — CLAUDE.md).

**로컬 상태:** `email: string`, `emailStatus: 'idle'|'sending'|'sent'|'error'`, `errorMsg: string`.

**구조/동작:**
- 브랜드 헤더(🎸 + `ko.brand`="Chordex" + 한 줄 카피).
- 버튼 "Google로 계속" → `signInWithGoogle()`. "Apple로 계속" → `signInWithApple()`.
- 구분선("또는 이메일로").
- 이메일 `<form onSubmit>`: input(`type="email"`, label 연결) + 제출 버튼. 제출 시 (a) 클라이언트 측 형식 검증(빈/`@` 없음 → 호출 안 함, `emailStatus='error'`+메시지), (b) 통과 시 `emailStatus='sending'` → `signInWithEmail(email)` → 결과로 `'sent'`(="메일의 링크를 확인하세요" 안내) / `'error'`(에러 메시지).
- 접근성: 각 버튼 `type="button"`, 폼 제출은 `type="submit"`, input에 `aria-label`/`<label htmlFor>`, 에러는 `role="alert"`.

**i18n:** 신규 문자열은 `src/i18n/strings.ts`의 `ko`에 추가(`login*` 키군). EN은 MVP 후순위(현 코드도 ko 중심) — 키만 ko로 채운다.

**props:** 없음(컨텍스트에서 메서드 취득). 테스트 용이성을 위해 부수효과는 전부 `useAuth()` 경유.

### 2.4 로그아웃 컨트롤 위치 — **Sidebar 푸터**

**결정: 로그아웃 버튼은 `Sidebar` 푸터(`.foot` 영역, "이번 주" 통계 아래)에 둔다.** 근거:
- Header(`src/components/Header.tsx`)는 props-only 순수 프레젠테이션 + `.logBtn`("연습 기록" 버튼) 이미 점유 → "Log"(기록) vs "Logout"(로그아웃) 라벨 충돌·혼동 위험. Header를 건드리면 Header 테스트도 흔들린다.
- Sidebar는 이미 `useApp()`을 쓰는 컨테이너 → `useAuth()` 추가가 자연스럽고, 계정 영역(브랜드/주간통계)과 시맨틱이 맞다.
- **로컬 모드에서는 로그아웃 버튼을 숨긴다**(`status==='local-mode'`면 미렌더 — 로그아웃할 세션이 없음). `status==='authenticated'`일 때만 렌더.

```tsx
// Sidebar.tsx 푸터에 추가 (개념)
const { status, signOut } = useAuth();
// ...foot 내부...
{status === 'authenticated' && (
  <button type="button" className={styles.logoutBtn} onClick={() => void signOut()}>
    {ko.logout}
  </button>
)}
```
> Sidebar는 `AppProvider`(=`authenticated`|`local-mode`) 하위에서만 마운트되므로 `useAuth()` 컨텍스트가 항상 존재한다. `local-mode`에서 버튼만 숨기면 된다.

---

## 3. main.tsx / App.tsx 재구성 — 정확한 새 트리

정본 §4.5 트리를 현 코드에 매핑. **`AppProvider`와 그 동기 초기화는 그대로 둔다.**

### 3.1 새 트리
```
main.tsx
  <StrictMode>
    <AuthProvider>            ← 신규: 세션 상태/메서드 (유일 async = 세션 확인)
      <AuthGate>              ← 신규: loading | unauthenticated(LoginScreen) | authenticated/local-mode(children)
        <App/>               ← 기존 그대로: <AppProvider><Shell/></AppProvider> (동기 loadAll)
      </AuthGate>
    </AuthProvider>
  </StrictMode>
void initNative();            ← 위치 유지
```

### 3.2 무엇이 어디로 가나(최소 변경)
- **`src/main.tsx` (변경):** `<App/>`를 `<AuthProvider><AuthGate><App/></AuthGate></AuthProvider>`로 감싼다. 그 외(`createRoot`, `initNative()`, css import) 불변.
- **`src/App.tsx` (변경 없음 권장):** `App()`은 계속 `<AppProvider><Shell/></AppProvider>`를 반환. **`AppProvider`/`Shell`은 게이트 통과 후(=`authenticated`|`local-mode`)에만 마운트**되므로, 자연히 "세션 확정 후 데이터 로드"가 된다(정본 §4.5 핵심). `App.tsx`는 손대지 않는다 → App 관련 회귀면 최소화.
  - *대안(불채택):* `AuthProvider`/`AuthGate`를 `App.tsx` 안으로 넣기. → `main.tsx`가 더 깔끔할 수 있으나, 트리 책임이 한 파일에 뭉치고 테스트 시 게이트 우회가 까다로워짐. **main.tsx 래핑 채택.**

### 3.3 기존 테스트 보호(중요)
- 현 `src/test-utils.tsx`의 `renderWithProvider`는 `<AppProvider>{ui}</AppProvider>`만 감싼다 → **`AuthProvider`/`AuthGate`를 거치지 않음** → 기존 뷰/컴포넌트 테스트는 게이트 영향 0(이미 "authenticated 이후" 세계를 직접 렌더). **`renderWithProvider`는 변경하지 않는다.**
- Sidebar에 `useAuth()`가 추가되므로, **Sidebar를 `renderWithProvider`로 렌더하는 기존 테스트가 깨질 수 있다**(컨텍스트 부재 throw). → 두 가지 중 택1(구현자 판단, §6 단계4):
  - (A) `useAuth()`를 **컨텍스트 없을 때 안전 기본값**(`status:'local-mode'`, no-op)으로 폴백하게 만들기 → 테스트 무수정. **권장**(로그아웃 버튼은 local-mode에서 숨김이라 시각 회귀도 없음).
  - (B) `test-utils`에 `AuthProvider`를 추가로 감싸기. → 더 많은 mock 필요. 비권장.
  - **결정: (A) `useAuth`는 Provider 부재 시 throw 대신 local-mode 기본값 반환** — 단, 이 폴백은 `AuthGate`/`LoginScreen` 경로에선 실제 Provider가 항상 있으므로 프로덕션 안전. (현 `useApp`은 throw지만, `useAuth`는 테스트 호환을 위해 의도적으로 관대하게.)

---

## 4. 검증 경계면 (QA boundaries)

| ID | 생산자 | 소비자 | 계약/규칙 |
|---|---|---|---|
| **B2-a 세션 영속** | `supabase.auth.getSession` (mock) | `AuthProvider`→`AuthGate` | 초기 세션 있으면 `loading→authenticated`, LoginScreen 미노출 |
| **B2-b 세션 전이** | `onAuthStateChange` (mock 콜백) | `AuthGate` | `SIGNED_IN`→children, `SIGNED_OUT`→LoginScreen |
| **B2-c signOut 정리** | 로그아웃 버튼 | `supabase.auth.signOut` | 클릭→signOut 1회, 구독 cleanup 호출 |
| **게이트 분기** | `AuthProvider.status` | `AuthGate` | loading=splash / unauth=Login / auth=children / local-mode=children. 4-갈래 배타 |
| **로컬 모드 폴백 (AC-11)** | `isSupabaseConfigured===false` | `AuthGate` | children 직접 렌더, **`supabase.auth` 미호출**(null 크래시 없음), 로그인 벽 없음 |
| **메서드 계약** | `LoginScreen`/Sidebar 핸들러 | `supabase.auth.*` | google/apple OAuth 인자 정확(`redirectTo`), email OTP(`emailRedirectTo`), signOut |
| **회귀 불변** | PR④ 전체 | CI | 기존 **158 테스트 + `npm run build`** 그린, 뷰/리듀서/도메인 무변경 |

> qa-verifier는 위 표를 체크리스트로 사용. 특히 **로컬 모드 폴백**(null client에 auth 호출 0)과 **회귀 0**(158+build)이 게이트.

---

## 5. 테스트 계획 (RTL + mock `supabase.auth`)

PR②/③ 헤르메틱 패턴 답습: `vi.mock`으로 `../lib/supabase` 모듈을 통째 모킹. env 분기 자체를 검증하는 케이스는 `vi.stubEnv` + `vi.resetModules` + 동적 import(현 `src/lib/__tests__/supabase.test.ts`와 동일 기법).

### 5.1 mock 전략
- **대부분의 게이트/컴포넌트 테스트:** `../lib/supabase` 모듈을 mock하여 `supabase`(가짜 auth 객체)와 `isSupabaseConfigured`를 **테스트별로 주입**한다.
```typescript
// 예시 (개념)
const authMock = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
};
vi.mock('../lib/supabase', () => ({
  supabase: { auth: authMock },
  isSupabaseConfigured: true,
}));
```
- **로컬 모드 케이스:** `vi.mock('../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }))`.
- `getSession`이 resolve될 때까지의 `loading` 검증은 `await findBy*`/`waitFor`로 전이 후 단언. 초기 splash는 동기 단언(첫 렌더).

### 5.2 게이트 분기 테스트 케이스(열거)
`src/auth/__tests__/AuthGate.test.tsx` (또는 AuthProvider+Gate 통합):
1. **loading:** `getSession`이 미결 Promise → 첫 렌더에 splash, LoginScreen/children 부재.
2. **unauthenticated:** `getSession`→`{session:null}` → resolve 후 LoginScreen 렌더, children(예: testid `app-children`) 부재. (AC④-1)
3. **authenticated (초기 세션):** `getSession`→`{session: fakeSession}` → children 렌더, LoginScreen 부재. (AC④-2/AC④-3 · B2-a)
4. **SIGNED_IN 전이:** 초기 `{session:null}` → LoginScreen → `onAuthStateChange` 콜백을 `('SIGNED_IN', fakeSession)`로 호출 → children으로 전이. (B2-b)
5. **SIGNED_OUT 전이:** 초기 authenticated → 콜백 `('SIGNED_OUT', null)` → LoginScreen 복귀. (B2-b)
6. **local-mode (AC-11 핵심):** `isSupabaseConfigured=false`, `supabase=null` → children 즉시 렌더, LoginScreen 부재, **`getSession`/`onAuthStateChange` 호출 0**(mock auth 자체가 없음 → null 역참조 없음 확인). (AC④-7)
7. **구독 정리:** 언마운트 시 `subscription.unsubscribe` 1회. (AC④-9)

### 5.3 LoginScreen 테스트 케이스
`src/auth/__tests__/LoginScreen.test.tsx` (mock auth, configured=true):
1. Google 버튼 클릭 → `signInWithOAuth` `{provider:'google', options:{redirectTo: window.location.origin}}` 1회. (AC④-4)
2. Apple 버튼 클릭 → `provider:'apple'` 동일 형태.
3. 이메일 빈/형식오류 제출 → `signInWithOtp` **미호출** + 에러 메시지(`role="alert"`).
4. 유효 이메일 제출 → `signInWithOtp` `{email, options:{emailRedirectTo: origin}}` 1회 + "메일 확인" 안내. (AC④-5)
5. OTP가 `{error}` 반환 → 에러 메시지 노출.

### 5.4 로그아웃(Sidebar) 테스트
`src/components/__tests__/Sidebar.test.tsx`에 보강(또는 신규):
1. `status='authenticated'` → 로그아웃 버튼 보임, 클릭 → `signOut` 1회. (AC④-6 · B2-c)
2. `status='local-mode'` → 로그아웃 버튼 미렌더.
> Sidebar 테스트는 `useAuth` mock 또는 §3.3(A) 폴백(local-mode 기본값)에 의존. (A) 채택 시 기존 Sidebar 테스트(인증 mock 없음)는 local-mode로 떨어져 **로그아웃 버튼 없음** = 기존 스냅샷/단언 무변경.

### 5.5 회귀
- 기존 **158 테스트** 전체 + `npm run build`. `renderWithProvider` 미변경이 회귀 0의 핵심(§3.3). 신규 테스트만 추가.

---

## 6. 단계별 빌드 순서 (TDD) + 파일 맵

### 6.1 빌드 순서(테스트 우선)
1. **i18n 문자열 추가** — `ko`에 `login*`/`logout` 키(테스트가 라벨로 쿼리하므로 먼저 고정). 빌드 그린 확인.
2. **AuthProvider (TDD)** — 먼저 AuthProvider+컨텍스트 테스트(getSession 분기, onAuthStateChange 구독/정리, 메서드 위임, local-mode no-op). 그 다음 구현. (B2, 메서드 계약)
3. **AuthGate (TDD)** — §5.2 7케이스 테스트 → 구현(순수 분기 + AuthSplash). (게이트 분기, 로컬 모드 폴백)
4. **LoginScreen (TDD)** — §5.3 5케이스 → 구현 + `LoginScreen.module.css`(tokens.css 재현). (메서드 계약)
5. **Sidebar 로그아웃 + `useAuth` 폴백** — §3.3(A) 폴백 결정 반영, §5.4 테스트 → Sidebar 푸터 버튼 + `.logoutBtn` 스타일. 기존 Sidebar 테스트 회귀 확인.
6. **main.tsx 트리 재구성** — 래핑. 빌드/스모크.
7. **전체 회귀** — `npm test`(158+신규) + `npm run build` 그린. → PR 생성(자동 머지 게이트 통과 대기).

### 6.2 파일 맵

**신규 (new):**
```
src/auth/AuthProvider.tsx          # 세션 컨텍스트 + signIn/signOut 메서드 + useAuth 훅
src/auth/AuthGate.tsx              # 4-상태 분기(loading/unauth/auth/local-mode) + AuthSplash
src/auth/LoginScreen.tsx          # Google/Apple OAuth 버튼 + 이메일 매직링크 폼
src/auth/LoginScreen.module.css   # 로그인 화면 스타일 (tokens.css 재현)
src/auth/AuthGate.module.css      # (선택) 스플래시 스타일 — 또는 LoginScreen.module.css 공유
src/auth/__tests__/AuthProvider.test.tsx
src/auth/__tests__/AuthGate.test.tsx
src/auth/__tests__/LoginScreen.test.tsx
```

**변경 (changed):**
```
src/main.tsx                       # <App/> → <AuthProvider><AuthGate><App/></AuthGate></AuthProvider>
src/components/Sidebar.tsx         # 푸터에 로그아웃 버튼(authenticated일 때만), useAuth() 사용
src/components/Sidebar.module.css  # .logoutBtn 스타일 추가
src/i18n/strings.ts                # ko에 login*/logout 키 추가
src/components/__tests__/Sidebar.test.tsx  # 로그아웃 케이스 보강(존재 시) 또는 신규
```

**변경 금지 (do NOT touch):**
```
src/App.tsx                        # AppProvider/Shell 그대로 (게이트 통과 후 마운트)
src/state/AppContext.tsx           # 동기 loadAll 유지 — async 승격 금지(PR⑤ 영역)
src/state/repository.ts            # Repository 인터페이스 불변
src/state/local-repository.ts      # 불변
src/state/supabase-repository.ts   # 미배선 유지 (PR⑤에서 배선)
src/lib/supabase.ts                # PR②에서 완성 — 불변
src/test-utils.tsx                 # renderWithProvider 불변 (회귀 0의 핵심)
src/state/appReducer.ts, src/domain/**, 모든 뷰  # 무관
```

---

## 7. 불변 / 주의 (CLAUDE.md 준수)

- **CSS Modules + tokens.css:** `LoginScreen.module.css`는 인라인 스타일 프로토타입 복사 금지. 색은 토큰만 사용(`--c-ink`, `--c-border`, `--c-panel`, `--c-canvas`, `--c-accent`, `--r-pill`, `--r-card`, `--f-sans`, `--s-*`). 로그인 버튼은 Header `.logBtn`(`background: var(--c-ink); color:#fff; border-radius: var(--r-pill)`) 톤을 재현. OAuth 버튼은 outline 변형(`border: 1px solid var(--c-border)` + `--c-canvas`).
- **시크릿 금지:** `.env`/키를 코드/깃에 넣지 않음. `redirectTo`/`emailRedirectTo`는 `window.location.origin`(런타임 값). anon key·URL은 PR②의 `import.meta.env` 경유(이미 처리). service_role 절대 금지.
- **계층 분리:** `supabase.auth`를 만지는 곳은 **`AuthProvider` 단 한 곳**. `LoginScreen`/`Sidebar`는 `useAuth()` 메서드만 호출(직접 SDK 호출 금지) — 도메인/상태 계층 분리 원칙의 인증판.
- **순수성:** `AuthGate`는 effect 없는 순수 분기. 부수효과(getSession/구독)는 `AuthProvider`에 격리 → 테스트 단순.
- **null 안전:** 모든 `supabase.auth` 접근은 configured 가드 안에서만(`AuthProvider` effect/메서드). local-mode 경로는 SDK를 절대 건드리지 않음(AC-11).
- **StrictMode 이중 마운트:** dev StrictMode에서 effect 2회 실행 → 구독 cleanup이 멱등해야 함(`unsubscribe` + `active` 가드). 테스트도 cleanup 1회 단언 시 이 점 유의.
- **PR 규칙:** 브랜치 `feat/web-auth-gate`, Conventional Commits, 작업단위 단일 PR(동기화/RLS/마이그레이션 섞지 않음). `main` 직접 push 금지, 자동 머지 게이트 우회 금지.

---

## 8. 사용자 사전 준비물 노트 (코드·테스트는 지금 전부 검증 가능)

> **중요:** 아래는 **실제(LIVE) 로그인**에만 필요하다. PR④의 **코드 + 테스트는 mock으로 지금 완전히 빌드·검증 가능**하며 CI 그린이 된다(env 없으면 로컬 모드, 있으면 mock auth). 아래 준비물은 머지 후 실제 로그인 시연 시점에 필요.

- **§9.4 Supabase Auth URL 설정 (필수, 모든 LIVE 방식 공통):** Auth → URL Configuration → Site URL + Redirect URLs에 웹 origin 등록.
- **§9.2 Google OAuth (LIVE Google):** Google Cloud Console OAuth 동의화면 + 웹 클라이언트 ID, Supabase Google provider 활성화. → 미설정 시 Google 버튼은 동작하나 provider 오류.
- **§9.3 Apple Sign in (LIVE Apple):** Apple Developer Program($99/년) + Services ID + Key, Supabase Apple provider 활성화. **가장 무거운 사전 준비.**
- **이메일 매직링크 = 가장 마찰 적은 LIVE 경로:** Supabase에서 이메일 인증만 켜면 됨(별도 콘솔/결제 불필요, 무료 티어 메일 한도만 확인 — §9.4). **권장: LIVE 시연은 이메일 매직링크부터.**
- **공통:** `.env`에 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` 설정 시 앱이 configured 모드로 전환되어 로그인 게이트가 활성화된다(미설정이면 로컬 모드 유지).

---

## 9. 구현자 오픈 퀘스천 (착수 전 확인 권장)

1. **`useAuth` Provider 부재 처리:** §3.3(A) "throw 대신 local-mode 기본값 반환" 채택을 권장했다. 이는 현 `useApp`(throw)과 다른 정책 — 회귀 0을 위한 의도적 선택. 동의하면 그대로, 더 엄격히 가려면 (B) test-utils에 AuthProvider 추가. **(A) 권장.**
2. **AuthSplash 디자인 정본 부재:** `_workspace/00_input/design`에 로딩 스플래시/로그인 화면 시안이 없을 가능성. 시안 없으면 토큰 기반 미니멀(중앙 정렬 🎸 + 브랜드 + 스피너/문구)로 구성하되, 시안이 있으면 그 시각 재현. → 구현 전 design 폴더 확인.
3. **EN i18n:** `login*` 문자열을 EN(`en`)에도 채울지. MVP는 ko 중심이므로 ko만 채우고 EN은 후속 i18n PR로 미루는 것을 권장(범위 최소).

---

## 10. 요약

PR④는 **세션 게이트 한 겹**을 앱 앞에 추가하는 최소·비회귀 변경이다. 유일한 신규 비동기는 세션 확인(`AuthProvider`)이며, `AppProvider`의 동기 `LocalRepository` 초기화는 불변이다. 로컬 모드(env 없음)는 children을 그대로 통과시켜 기존 158 테스트 + CI를 그린으로 유지한다. repo 교체/동기화/마이그레이션/네이티브는 전부 후속 PR(⑤⑥)로 분리한다.
