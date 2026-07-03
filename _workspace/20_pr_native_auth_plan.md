# 설계: PR⑥ `feat/native-auth` — Capacitor 네이티브 인증 + 온라인 감지

> 산출물: `_workspace/20_pr_native_auth_plan.md`
> 대상: implementer(구현 단위), qa-verifier(검증 경계면), 사용자(승인/콘솔/디바이스 체크포인트)
> 정본: `_workspace/05_backend_auth_plan.md` §4.1·§4.2·§4.4·§8(PR⑥)·§9.2/9.3/9.5·부록. `CLAUDE.md`(계층 분리·When Unsure·모바일).
> 전제: PR④(웹 인증 게이트)·PR⑤(동기화) 머지 완료. 현재 브랜치 `feat/native-auth`(main=PR⑤ 포함).
> **성격**: 이 PR은 "웹 회귀 0"을 최우선 제약으로 하는 네이티브 확장이다. 모든 신규 네이티브 경로는 `Capacitor.isNativePlatform()` 가드 뒤에 있고, 웹 vitest·웹 빌드는 무영향이어야 한다.

---

## 0. 현재 코드 상태 실측 (통합 대상 — 이미 존재하는 것 vs 추가할 것)

작업 전 실제 파일을 읽고 확인한 결과. **정본이 "신규"라 표기했더라도 이미 있는 것은 재작성 금지, 없는 것만 추가**한다.

| 항목 | 정본 표기 | 실측 상태 | PR⑥ 조치 |
|---|---|---|---|
| `src/lib/supabase.ts` 네이티브 storage 어댑터(`@capacitor/preferences`) | §4.2 신규 | **이미 존재**(PR② 반영). `nativeStorage` + `flowType:'pkce'` + `detectSessionInUrl: !isNativePlatform()` + `storage: isNativePlatform()?adapter:undefined` 완비 | **변경 없음**(그대로 사용). 회귀 방지 위해 손대지 않는다 |
| `src/auth/AuthProvider.tsx` sign-in 메서드 | §4.4 네이티브 분기 추가 | 웹 전용: `signInWithGoogle/Apple`=`signInWithOAuth`, `signInWithEmail`=`signInWithOtp`. 4상태(`loading/unauthenticated/authenticated/local-mode`) | **네이티브 분기 추가**(가드 뒤): iOS/Android Apple·Google=네이티브 `signInWithIdToken`. 웹 경로 원형 유지 |
| `src/native.ts` | §부록 변경(appStateChange) | 존재. `initNative()`가 StatusBar/SplashScreen만. 딥링크 리스너·appStateChange **없음** | 딥링크 리스너(`App.addListener('appUrlOpen')`) + appStateChange 토큰 갱신 등록 **추가** |
| `src/sync/net.ts` | §6.1 후속(PR⑥) | 존재. `navigator.onLine` + `online` 이벤트만. `@capacitor/network` **없음** | 네이티브 감지 고도화 **추가**(웹 폴백 유지, 소비자 `sync-repository.ts` 시그니처 무변경) |
| `capacitor.config.ts` | §부록 변경 | appId `com.chordsalon.app`, webDir `dist`. 스킴 설정 없음 | 필요 시 딥링크 관련 주석/설정 검토(스킴은 네이티브 파일이 소유 → config 변경 최소) |
| `android/` 프로젝트 | §4.4(C) | **존재**. `strings.xml`에 `custom_url_scheme=com.chordsalon.app` **이미 있음**. `AndroidManifest.xml`엔 LAUNCHER intent-filter만(BROWSABLE 딥링크 **없음**), `launchMode="singleTask"` 있음 | Manifest에 **BROWSABLE intent-filter 추가**(strings.xml은 그대로) |
| `ios/` 프로젝트 | §4.4(C) | **미존재**(Mac 필요라 미생성) | **생성 불가**(§4구획-4). Info.plist 지침만 문서로 제공 |
| 네이티브 sign-in 플러그인 | §4.4(A) | 미설치 | **새 런타임 의존성 — 사용자 승인 필요**(§4구획-2) |
| `@capacitor/browser`, `@capacitor/network` | §4.4(B)·§6.1 | 미설치 | **새 런타임 의존성 — 사용자 승인 필요**(§4구획-2) |
| `@capacitor/app` | §4.4(B) | **이미 설치**(`^8.1.0`) | 그대로 사용(딥링크·appStateChange 리스너 소스) |

**핵심 함의**: supabase.ts는 이미 네이티브 대비가 끝나 있다. PR⑥의 실제 코드 변경면은 (1) 새 순수 파서 모듈, (2) AuthProvider 네이티브 분기, (3) native.ts 딥링크/appState 리스너, (4) net.ts 네이티브 감지, (5) AndroidManifest intent-filter — 이 5곳으로 좁게 격리된다.

---

## 1. 수용 기준 (AC) — 각 항목에 [검증 방법 · 웹테스트 vs 디바이스] 표기

`[웹]`=vitest로 자동 검증 가능(mock). `[디바이스]`=실기기/에뮬레이터 수동 e2e(Claude 불가). `[빌드]`=`npm run build`/`cap sync` 그린으로 검증.

| AC | 기준 | 검증 방법 | 웹 vs 디바이스 |
|---|---|---|---|
| **AC-1** | 딥링크 콜백 URL에서 PKCE `code`를 추출한다(`com.chordsalon.app://auth-callback?code=XXX`) | `parseAuthCallback` 단위테스트 | **[웹]** |
| **AC-2** | 딥링크 콜백 URL 해시(implicit)에서 `access_token`/`refresh_token`을 추출한다(`#access_token=...&refresh_token=...`) | 같은 파서 단위테스트 | **[웹]** |
| **AC-3** | 콜백 URL의 `error`/`error_description`을 추출한다(사용자 취소·거부 처리) | 파서 단위테스트 | **[웹]** |
| **AC-4** | 앱 스킴이 아닌 URL·파라미터 없는 URL은 `kind:'none'`으로 반환(무해) | 파서 단위테스트 | **[웹]** |
| **AC-5** | `Capacitor.isNativePlatform()===false`(웹)이면 `signInWithGoogle/Apple`은 기존 `signInWithOAuth` 경로를 그대로 탄다(회귀 0) | AuthProvider 테스트(플랫폼 mock=web) | **[웹]** |
| **AC-6** | `isNativePlatform()===true`이고 Apple이면 네이티브 Apple 시트 어댑터→`signInWithIdToken({provider:'apple'})` 경로를 호출한다 | AuthProvider 테스트(플랫폼 mock=native, 어댑터 mock) | **[웹]**(호출 경로만) |
| **AC-7** | `isNativePlatform()===true`이고 Google이면 네이티브 Google 어댑터→`signInWithIdToken({provider:'google'})` 경로를 호출한다 | 동상 | **[웹]**(호출 경로만) |
| **AC-8** | `isSupabaseConfigured===false`(local-mode)면 네이티브 분기도 no-op(안티-브릭) | AuthProvider 테스트 | **[웹]** |
| **AC-9** | `net.ts`가 네이티브에서 `@capacitor/network`의 `getStatus()`/`addListener`를 사용하고, 웹에서는 기존 `navigator.onLine`/`online` 폴백을 유지한다. `isOnline()`/`onOnline()` 시그니처 불변 | net 단위테스트(플랫폼·Network mock 양방향) | **[웹]** |
| **AC-10** | 실기기 iOS에서 "Apple로 계속"→네이티브 시트→로그인 성공→세션 유지 | 수동 e2e | **[디바이스·Mac]** |
| **AC-11** | 실기기 Android에서 "Google로 계속"→네이티브 시트→로그인 성공. 딥링크 폴백 왕복(브라우저→앱 복귀→세션) | 수동 e2e | **[디바이스]** |
| **AC-12** | 웹 빌드/기존 40개 테스트 파일 전부 그린. `cap sync android` 성공(새 플러그인 링크) | `npm run build`·`npm test`·`cap sync` | **[빌드]**(웹) / **[디바이스]**(cap sync는 로컬 안드로이드 툴체인) |
| **AC-13** | 앱 포그라운드 복귀 시 토큰 자동 갱신(`appStateChange`→`startAutoRefresh`) 등록됨 | native.ts 리스너 등록 단위테스트(App mock) | **[웹]**(등록 검증) / **[디바이스]**(실동작) |

> **웹 회귀 0 게이트**: AC-5·AC-8·AC-9·AC-12는 "웹이 지금과 똑같이 동작한다"의 증거다. 이 4개가 그린이 아니면 PR⑥은 머지 불가.

---

## 2. 데이터 / 타입 계약

### 2.1 딥링크 콜백 파서 (순수 함수 — 테스트 1급, §부록 정본)

`src/auth/deepLinkAuth.ts` (신규) — **React·Capacitor·supabase 전부 무의존**. URL 문자열 in → 판별 결과 out.

```typescript
// src/auth/deepLinkAuth.ts
/** 딥링크 콜백 URL 파싱 결과 (판별 유니온 — 불가능 상태 차단). */
export type AuthCallback =
  | { kind: 'code'; code: string }                              // PKCE: ?code=... → exchangeCodeForSession
  | { kind: 'tokens'; accessToken: string; refreshToken: string } // implicit hash → setSession
  | { kind: 'error'; error: string; description: string | null }  // ?error=access_denied 등
  | { kind: 'none' };                                           // 인증 콜백 아님(무해)

/**
 * 딥링크로 열린 URL을 인증 콜백으로 판별한다.
 * - PKCE code: query `?code=` (에러 파라미터 없을 때). exchangeCodeForSession 대상.
 * - implicit tokens: hash `#access_token=&refresh_token=`. setSession 대상.
 * - error: query 또는 hash의 `error`/`error_description`. 사용자 취소·거부.
 * - none: 위 어느 것도 아님(스킴만 열림 등) — 호출자는 무시.
 *
 * 우선순위: error > code > tokens > none.
 * 잘못된 URL 문자열이어도 throw하지 않고 { kind:'none' } 반환(방어적).
 */
export function parseAuthCallback(rawUrl: string): AuthCallback;
```

- **파싱 규칙(정본 §4.4 (B) + 부록 준수)**:
  - `new URL(rawUrl)` 실패 시 → `{ kind:'none' }`.
  - `searchParams`와 `hash`(`#` 뒤를 `URLSearchParams`로) 둘 다 검사.
  - `error`(query 또는 hash) 존재 → `{ kind:'error', error, description: error_description ?? null }`.
  - `code`(query) 존재 → `{ kind:'code', code }`.
  - `access_token` && `refresh_token`(hash 우선, query 폴백) → `{ kind:'tokens', ... }`.
  - 그 외 → `{ kind:'none' }`.
- **경계면**: 이 함수는 세션을 만들지 않는다. "무엇을 교환해야 하는가"만 판별. 실제 `exchangeCodeForSession`/`setSession` 호출은 `native.ts` 리스너(supabase client 소유)가 수행 → 계층 분리(파서=순수, 부수효과=native.ts).

### 2.2 네이티브 sign-in 어댑터 인터페이스 (플러그인 격리)

플러그인을 AuthProvider가 직접 import하면 (a) 웹 번들에 네이티브 코드 유입, (b) 테스트에서 mock 어려움. → **얇은 어댑터로 격리**하고 동적 import를 가드 뒤에서 수행.

```typescript
// src/auth/nativeSignIn.ts (신규) — 네이티브에서만 호출(가드는 AuthProvider가)
/** 네이티브 시트가 반환하는 최소 토큰 계약(플러그인 무관 정규화). */
export interface NativeIdToken {
  idToken: string;
  nonce?: string;       // Apple: raw nonce(해시 전) — signInWithIdToken에 필요
}

/** Apple 네이티브 시트 → identityToken(+nonce). 실패/취소는 throw. */
export function appleNativeIdToken(): Promise<NativeIdToken>;
/** Google 네이티브 시트 → idToken. 실패/취소는 throw. */
export function googleNativeIdToken(): Promise<NativeIdToken>;
```

- 각 함수 내부에서 **플러그인을 동적 `import()`** 하고 호출한다. → 웹 트리쉐이킹 시 네이티브 플러그인이 초기 청크에 안 들어가고, `isNativePlatform()` 가드로 웹에선 절대 실행 안 됨.
- AuthProvider는 `nativeSignIn`의 두 함수만 알면 되고, 반환된 토큰을 `supabase.auth.signInWithIdToken(...)`에 넘긴다(supabase 접근은 AuthProvider가 소유 — 계층 분리 유지).

### 2.3 net.ts 네이티브 감지 (시그니처 불변 계약)

```typescript
// src/sync/net.ts (변경) — 공개 시그니처는 그대로. 내부만 네이티브 인지.
export function isOnline(): boolean;          // 시그니처 불변(동기). 소비자 sync-repository.ts 무변경
export function onOnline(cb: () => void): () => void; // 시그니처 불변(해제 함수 반환)
```

- **계약 유지가 핵심**: `sync-repository.ts`가 `isOnline()`(동기 bool)·`onOnline(cb)`를 쓴다. 이 시그니처를 바꾸면 PR⑤ 코드 회귀. → **동기 시그니처 유지**.
- 네이티브 감지 전략(정본 §6.1 "고도화"): `@capacitor/network`는 `getStatus()`가 **비동기**다. 동기 `isOnline()`을 유지하려면 → **모듈 로드 시 네이티브면 `Network.addListener('networkStatusChange')`로 최신 상태를 캐시**하고 `isOnline()`은 캐시값 반환. 웹이면 기존 `navigator.onLine` 즉시 반환.
- `onOnline(cb)`: 네이티브면 `Network.addListener`가 `connected:true` 전이 시 cb 호출(해제 함수 반환), 웹이면 기존 `window 'online'`.

---

## 3. 컴포넌트/모듈 경계 (트리 무변경 — 로직만 확장)

main.tsx 트리는 **변경 없음**(`AuthProvider → AuthGate → App`). RepoBoundary/SyncRepo/MigrationController **변경 없음**. 확장은 아래 5개 파일 내부에 국한.

```txt
main.tsx (무변경)
  └─ AuthProvider (변경: sign-in 메서드에 네이티브 분기)
       │   ├─ (웹)   signInWithOAuth / signInWithOtp   ← 기존 경로 원형 유지
       │   └─ (네이티브) nativeSignIn.* → signInWithIdToken  ← 신규 분기
       └─ AuthGate → App (무변경)

native.ts (변경: initNative에 리스너 등록 추가)
  ├─ App.addListener('appUrlOpen') → parseAuthCallback(url) → supabase.exchangeCodeForSession/setSession
  └─ App.addListener('appStateChange') → supabase.startAutoRefresh/stopAutoRefresh

deepLinkAuth.ts (신규·순수)  ← native.ts가 소비, vitest 1급
nativeSignIn.ts  (신규)      ← AuthProvider가 소비(동적 import로 플러그인 격리)
net.ts (변경)                ← sync-repository.ts가 소비(시그니처 불변)
```

**계층 규칙 준수**:
- supabase client 접근은 **AuthProvider(sign-in)와 native.ts(딥링크 교환)** 만. 파서·어댑터는 supabase 무의존.
- 도메인 불변값·`CollectedChord`·PR⑤ 동기화 코드(`sync-repository.ts`/`syncEngine`/`queue`/`apply-changes`)는 **건드리지 않음**(net.ts 시그니처 유지가 이를 보장).

---

## 4. ★ 4구획 분할표 (구현자·사용자가 "뭘 할 수 있고 뭘 못 하는지" 즉시 판별)

### 구획 1 — [여기서 구현 + 웹 vitest 테스트 가능] (Claude가 완결)

| 산출물 | 파일 | 테스트 | 웹 안전성 근거 |
|---|---|---|---|
| 딥링크 콜백 파서(순수) | `src/auth/deepLinkAuth.ts` (신규) | `deepLinkAuth.test.ts`: code/tokens/error/none 4종 + 잘못된 URL 방어 | React·Capacitor·supabase 무의존. 순수 문자열 함수 |
| AuthProvider 네이티브 분기(플랫폼 가드 로직) | `src/auth/AuthProvider.tsx` (변경) | `AuthProvider.native.test.tsx`: `isNativePlatform` mock(web/native)·`isSupabaseConfigured` mock으로 4경로(web-oauth / native-apple-idToken / native-google-idToken / local-mode no-op) 분기 검증 | 네이티브 분기는 `isNativePlatform()` 가드 뒤. 웹 경로는 기존 코드 그대로(회귀 0) |
| 네이티브 sign-in 어댑터(동적 import 격리) | `src/auth/nativeSignIn.ts` (신규) | 어댑터는 플러그인 동적 import라 단위테스트는 AuthProvider 레벨에서 mock. (얇은 배선이라 로직 최소) | 동적 `import()` → 웹 초기 청크에 플러그인 미포함. 가드로 웹 실행 차단 |
| net.ts 네이티브 감지 배선(웹 폴백 유지) | `src/sync/net.ts` (변경) | `net.test.ts` 확장: 웹(기존 3+3 케이스 유지) + 네이티브(`isNativePlatform` mock + `@capacitor/network` mock: getStatus/addListener) | 시그니처 불변→소비자 무영향. 네이티브 경로는 가드 뒤 |
| native.ts 리스너 등록(딥링크+appState) | `src/native.ts` (변경) | `native.test.ts` (신규): `App.addListener` mock으로 `appUrlOpen`·`appStateChange` 등록 확인 + `appUrlOpen` 콜백이 `parseAuthCallback` 결과에 따라 supabase 교환 호출(mock) | `initNative`는 이미 `isNativePlatform()` 가드로 시작. 웹은 즉시 return(무영향) |
| supabase.ts | **변경 없음** | — | 이미 네이티브 대비 완료(§0). 손대지 않음 = 회귀 0 |

> **구획 1은 이 PR의 "웹에서 검증 가능한 전부"다.** 파서·분기·감지·리스너 등록의 정확성은 여기서 확정된다. 실제 네이티브 시트가 뜨는지/딥링크가 실제로 앱을 깨우는지는 구획 4.

### 구획 2 — [새 런타임 의존성 — 사용자 확인 필요] (`CLAUDE.md` When Unsure)

**Claude는 설치를 임의 진행하지 않는다.** 아래 표를 사용자에게 제시하고 **승인 후** `npm i`.

| 패키지 | 버전(제안) | 용도 | 웹 빌드 안전성 근거 | 대안 |
|---|---|---|---|---|
| `@capacitor/browser` | `^8.x` (core 8과 정렬) | 딥링크 폴백 OAuth 시 외부 브라우저 오픈/닫기(§4.4 B) | 웹에서 import되더라도 `isNativePlatform()` 가드 뒤에서만 `Browser.open` 호출. Capacitor 웹 구현은 no-op/새 탭. 빌드 무해 | 없음(폴백 필수) |
| `@capacitor/network` | `^8.x` | 네이티브 온라인 감지(§6.1). getStatus/addListener | net.ts에서 네이티브 가드 뒤에서만 사용. 웹은 `navigator.onLine` 폴백 유지. 미사용 시 트리쉐이크 | 폴백만 유지(감지 고도화 생략) — 그러나 정본이 PR⑥ 범위로 명시 |
| Apple 네이티브: `@capacitor-community/apple-sign-in` | 최신 8-호환 태그(설치 시 확정) | iOS "Sign in with Apple" 네이티브 시트→identityToken(+nonce). **App Store 규정상 iOS 필수** | `nativeSignIn.ts`에서 **동적 import** + iOS 가드. 웹 번들 초기 청크 미포함. 웹 실행 안 함 | 없음(iOS 정책상 네이티브 Apple 필수) |
| Google 네이티브(택1): `@capgo/capacitor-social-login` **(권장)** 또는 `@codetrix-studio/capacitor-google-auth` | 최신 8-호환 | iOS/Android 네이티브 Google 시트→idToken(§4.4 A) | 동적 import + 가드. 웹 미포함 | 권장=`@capgo/capacitor-social-login`(Apple+Google 통합, 유지보수 활발). 대안=`@codetrix-studio/...`(Google 전용, 성숙) |

**웹 빌드 안전성 총괄 근거**:
1. `@capacitor/*` 공식 플러그인은 웹 스텁을 제공 → import만으로 빌드 안 깨짐.
2. 네이티브 sign-in 플러그인은 `nativeSignIn.ts`의 **동적 `import()`** 로만 로드 → `isNativePlatform()===false`면 절대 평가 안 됨.
3. 모든 호출부는 `Capacitor.isNativePlatform()` 가드 뒤 → 웹 런타임 경로에 네이티브 API 진입 불가.
4. 검증: 설치 후 `npm run build`(tsc+vite) 그린 + `npm test`(웹 40파일) 그린이 게이트(AC-12).

> **버전 정책**: `@capacitor/*` 공식 플러그인은 core `^8.4.1`과 major 정렬(8.x). 커뮤니티 플러그인은 Capacitor 8 호환 태그를 설치 시점에 확인해 고정. `npm i` 후 `cap sync`로 네이티브 링크.

### 구획 3 — [네이티브 프로젝트 설정 — 코드로 추가, 런타임 검증은 디바이스] (Claude가 파일은 작성)

| 설정 | 파일 | 조치 | 검증 |
|---|---|---|---|
| Android 커스텀 스킴 | `android/app/src/main/res/values/strings.xml` | **이미 `custom_url_scheme=com.chordsalon.app` 존재 → 변경 없음** | 확인만 |
| Android 딥링크 intent-filter | `android/app/src/main/AndroidManifest.xml` | `MainActivity`에 BROWSABLE intent-filter 추가: `<data android:scheme="@string/custom_url_scheme"/>` + `action.VIEW`, `category.DEFAULT`+`BROWSABLE`. (`launchMode="singleTask"` 이미 있음 → 딥링크가 기존 인스턴스로 전달됨) | `cap sync android` 후 빌드. 왕복은 [디바이스] |
| iOS 커스텀 스킴 | `ios/App/App/Info.plist` | **ios/ 미존재 → 파일 작성 불가**. 지침만 제공: `CFBundleURLTypes`에 `CFBundleURLSchemes=[com.chordsalon.app]` 추가. `cap add ios`(Mac) 후 편집 | [디바이스·Mac] |
| Capacitor config | `capacitor.config.ts` | 스킴은 네이티브 파일이 소유 → **config 변경 불필요**. (Apple/Google 플러그인이 요구하는 옵션이 있으면 설치 시점에 추가 검토) | 빌드 |

**Android intent-filter 추가 스펙**(구현자가 넣을 정확한 형태):
```xml
<!-- MainActivity 내부, LAUNCHER intent-filter 다음에 추가 -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="@string/custom_url_scheme" />
</intent-filter>
```

### 구획 4 — [내가 못 하는 것 — 사용자 Mac / 콘솔 / 디바이스]

| 작업 | 왜 못 하나 | 정본 |
|---|---|---|
| iOS 프로젝트 생성(`cap add ios`)·Info.plist 편집·빌드·서명·프로비저닝 | **Mac + Xcode 필수**. Windows 개발환경 | §9.5 |
| Apple Developer Program 가입($99/년)·App ID(`com.chordsalon.app`)+"Sign in with Apple" capability·Service ID·Key(.p8) 발급 | 외부 콘솔·결제·시크릿 | §9.3 |
| Google Cloud OAuth 클라이언트(iOS/Android용, 번들ID·SHA-1 등록)·Supabase Google provider 설정 | 외부 콘솔·시크릿 | §9.2 |
| Supabase Auth → URL Configuration → Redirect URLs에 `com.chordsalon.app://auth-callback` 추가 | Supabase 대시보드 | §9.4 |
| 실기기 딥링크 왕복 e2e(브라우저→앱 복귀→세션), Apple/Google 네이티브 시트 실동작 | 실기기·계정·네이티브 런타임 | AC-10·11·§9.5 |

**§9 사용자 콘솔 체크리스트(PR⑥ 착수 전/후)** — 정본 §9.2/9.3/9.5 발췌:
- [ ] (§9.2 Google) iOS/Android용 OAuth 클라이언트 ID 생성(번들ID·SHA-1). Supabase Google provider에 등록.
- [ ] (§9.3 Apple) Apple Developer 가입 → App ID + Sign in with Apple → Service ID/Key → Supabase Apple provider 등록.
- [ ] (§9.4) Supabase Redirect URLs에 `com.chordsalon.app://auth-callback` 추가(웹 origin 유지).
- [ ] (§9.5) Mac에서 `cap add ios` → Info.plist 스킴 → Xcode 서명. Android는 Windows에서 `cap sync android` 후 빌드.
- [ ] 네이티브 sign-in 플러그인 설치 후 `npx cap sync`.

---

## 5. 파일별 신규/변경 맵

```txt
신규:
  src/auth/deepLinkAuth.ts             # 순수 콜백 파서(구획 1)
  src/auth/__tests__/deepLinkAuth.test.ts
  src/auth/nativeSignIn.ts             # Apple/Google 네이티브 어댑터(동적 import 격리)
  src/auth/__tests__/AuthProvider.native.test.tsx  # 플랫폼 분기 테스트
  src/native.test.ts (또는 src/__tests__/native.test.ts)  # 리스너 등록/교환 호출 테스트

변경:
  src/auth/AuthProvider.tsx            # signInWithGoogle/Apple에 isNativePlatform() 분기 추가
  src/native.ts                        # initNative에 appUrlOpen·appStateChange 리스너 등록
  src/sync/net.ts                      # 네이티브 @capacitor/network 감지(시그니처 불변, 웹 폴백)
  src/sync/__tests__/net.test.ts       # 네이티브 경로 케이스 추가(웹 케이스 유지)
  android/app/src/main/AndroidManifest.xml  # BROWSABLE intent-filter 추가
  package.json                         # 새 의존성(구획 2 — 사용자 승인 후)

변경 없음(명시적 — 손대지 않음):
  src/lib/supabase.ts                  # 이미 네이티브 대비 완료(§0)
  src/main.tsx                         # 트리 무변경
  src/state/**                         # RepoBoundary/SyncRepo/MigrationController/apply-changes 등 PR⑤ 코드
  src/domain/**                        # 도메인 불변값·CollectedChord
  src/auth/AuthGate.tsx / LoginScreen.tsx  # 순수 분기/버튼 재사용
  android/.../strings.xml              # custom_url_scheme 이미 존재
  capacitor.config.ts                  # 스킴은 네이티브 파일 소유

작성 불가(디바이스/Mac):
  ios/App/App/Info.plist               # ios/ 미존재 — 지침만 문서로
```

---

## 6. 단계별 빌드 순서 (TDD 단위 — 한 호흡에 구현+테스트)

> 각 단계 후 `npm test`(웹) 그린 유지. 구획 2(의존성)는 **사용자 승인 체크포인트** 후 진행.

**단계 A — 딥링크 파서(순수, 의존성 0)** ⟶ 승인 불필요, 즉시 착수 가능
1. `deepLinkAuth.test.ts` 작성(실패): code/tokens/error/none + 잘못된 URL 방어 + 우선순위(error>code>tokens).
2. `deepLinkAuth.ts` 구현 → 그린. **웹 빌드/테스트 무영향(순수 모듈)**.

**단계 B — net.ts 네이티브 감지** ⟶ `@capacitor/network` 승인 필요
3. `net.test.ts` 확장(실패): 웹 케이스 유지 + 네이티브 케이스(`isNativePlatform` mock + Network mock getStatus/addListener). `isOnline`/`onOnline` 시그니처 불변.
4. `net.ts` 구현: 네이티브면 모듈 로드 시 status 캐시 + listener, 웹이면 기존 폴백 → 그린. **소비자 `sync-repository.ts` 무변경 확인**.

**단계 C — 네이티브 sign-in 어댑터 + AuthProvider 분기** ⟶ Apple/Google 플러그인 승인 필요
5. `nativeSignIn.ts` 작성(동적 import로 플러그인 호출, 토큰 정규화).
6. `AuthProvider.native.test.tsx` 작성(실패): 플랫폼·config mock으로 4경로 분기.
7. `AuthProvider.tsx` 변경: `signInWithGoogle/Apple`에 `if (Capacitor.isNativePlatform()) { ...idToken } else { 기존 OAuth }`. local-mode no-op 유지 → 그린. **웹 경로 회귀 0 확인(AC-5)**.

**단계 D — native.ts 리스너(딥링크 교환 + appState 갱신)** ⟶ `@capacitor/browser`(폴백 close용) 승인 필요
8. `native.test.ts` 작성(실패): `App.addListener` mock으로 `appUrlOpen`·`appStateChange` 등록 + `appUrlOpen` 콜백이 `parseAuthCallback` 결과별로 `exchangeCodeForSession`/`setSession`/무시 호출(supabase mock).
9. `native.ts` 변경: `initNative` 내 가드 뒤에서 두 리스너 등록. 딥링크 폴백 시 `Browser.close()`. → 그린.

**단계 E — Android 네이티브 설정** ⟶ 코드 파일(승인 불필요), 검증은 [디바이스]
10. `AndroidManifest.xml`에 BROWSABLE intent-filter 추가. `cap sync android` 성공 확인(로컬 안드로이드 툴체인).

**단계 F — 통합 검증(빌드 게이트)**
11. `npm run build`(tsc+vite 그린) + `npm test`(전 파일 그린) → AC-12. iOS 지침·§9 체크리스트를 PR 본문에 첨부.

> **의존성 승인 순서**: 단계 A는 승인 없이 착수. 단계 B/C/D는 구획 2 승인 후. → **권장: 사용자에게 구획 2 표를 먼저 승인받고 전체 착수**(중간에 멈추지 않게).

---

## 7. 회귀 위험 · 완화

| ID | 위험 | 영향 | 완화 |
|---|---|---|---|
| R1 | 새 플러그인 import가 웹 번들/빌드 파손 | 웹 회귀 | 네이티브 sign-in은 동적 `import()`+가드. 공식 `@capacitor/*`는 웹 스텁. AC-12(build+test 그린)가 게이트 |
| R2 | net.ts 시그니처 변경으로 sync-repository 회귀 | PR⑤ 동기화 파손 | `isOnline()`(동기 bool)·`onOnline(cb)` 시그니처 **불변** 강제. 네이티브는 캐시로 동기 유지 |
| R3 | `@capacitor/network` getStatus가 비동기라 첫 호출 시 상태 미확정 | 초기 온라인 오판 | 모듈 로드 즉시 getStatus 캐시 갱신 + listener. 미확정 시 낙관(true) 폴백(기존 정책과 일관) |
| R4 | AuthProvider 네이티브 분기가 웹 경로 오염 | 웹 로그인 회귀(PR④) | 분기는 `isNativePlatform()` 최상단 가드. 웹 브랜치는 기존 코드 문자 그대로. AC-5 테스트 |
| R5 | 딥링크 리스너 중복 등록(HMR/재마운트) | 콜백 다중 실행 | `initNative`는 앱당 1회(main.tsx). `App.addListener` 핸들 보관·중복 가드 |
| R6 | Apple nonce 처리 누락 | Apple 로그인 실패 | 어댑터가 raw nonce를 `signInWithIdToken({nonce})`로 전달(정본 §4.4 A). 디바이스 검증 |
| R7 | local-mode(env 미설정)에서 네이티브 분기 크래시 | 안티-브릭 위반 | 네이티브 분기도 `if(!supabase) return` no-op 유지. AC-8 테스트 |

---

## 8. 롤백 / 안티-브릭

- **롤백 단위**: PR⑥은 5개 파일 + 의존성. `git revert` 1회로 웹 상태 복귀(supabase.ts·main.tsx·state/**·domain/** 무변경이라 안전).
- **안티-브릭 불변식(유지)**:
  1. `isSupabaseConfigured===false` → 모든 인증(웹·네이티브) no-op, 앱은 local-mode로 완전 동작.
  2. `Capacitor.isNativePlatform()===false` → 네이티브 코드 경로 진입 0. 웹은 PR④/⑤와 동일.
  3. net.ts 실패(플러그인 부재 등) → `navigator.onLine` 폴백 → 동기화 계속.
- **부분 머지 가능성**: 단계 A(파서)·B(net)는 의존성 승인 전이라도 독립 그린. 최악의 경우 파서+net만 먼저, sign-in/딥링크는 콘솔 준비 후 후속 — 단, 정본은 PR⑥을 한 단위로 규정하므로 **원칙은 일괄**, 분리는 사용자 판단.

---

## 9. 검증 경계면 (qa-verifier 체크리스트)

| ID | 생산자 | 소비자 | 계약/규칙 | 검증 |
|---|---|---|---|---|
| N1 딥링크 파서 | `parseAuthCallback` | native.ts 교환 로직 | code/tokens/error/none 판별 정확, 우선순위, 방어적(throw 없음) | [웹] deepLinkAuth.test |
| N2 플랫폼 분기 | AuthProvider | supabase auth | web→signInWithOAuth, native→signInWithIdToken, local-mode→no-op | [웹] AuthProvider.native.test |
| N3 네이티브 감지 | net.ts | sync-repository | 시그니처 불변, 네이티브 Network 사용/웹 폴백, 온라인 전이 cb | [웹] net.test |
| N4 리스너 등록 | native.ts | App/supabase | appUrlOpen·appStateChange 등록, 콜백이 파서 결과별 교환 호출 | [웹] native.test |
| N5 Android 딥링크 | AndroidManifest | OS→앱 | BROWSABLE intent-filter, singleTask 전달 | [디바이스] cap sync+왕복 |
| N6 웹 회귀 0 | 전체 | 웹 빌드/테스트 | build 그린 + 40 테스트파일 그린 | [빌드] npm run build/test |
| N7 네이티브 e2e | 실기기 | Apple/Google 시트·딥링크 | 로그인 성공·세션 유지 | [디바이스·Mac] 수동 |

---

## 부록 — parseAuthCallback 골든 케이스 (테스트 시드)

```txt
1. 'com.chordsalon.app://auth-callback?code=abc123'
   → { kind:'code', code:'abc123' }
2. 'com.chordsalon.app://auth-callback#access_token=AT&refresh_token=RT&token_type=bearer'
   → { kind:'tokens', accessToken:'AT', refreshToken:'RT' }
3. 'com.chordsalon.app://auth-callback?error=access_denied&error_description=User+cancelled'
   → { kind:'error', error:'access_denied', description:'User cancelled' }
4. 'com.chordsalon.app://auth-callback'            → { kind:'none' }
5. 'https://example.com/other?foo=bar'             → { kind:'none' }  (code/token/error 없음)
6. 'not a url'                                      → { kind:'none' }  (URL 파싱 실패 방어)
7. code와 error 동시                                → error 우선(kind:'error')
8. hash에 error                                     → { kind:'error', ... }
```
