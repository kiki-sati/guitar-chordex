# QA 리포트: PR⑥ `feat/native-auth` — Capacitor 네이티브 인증 + 온라인 감지

> 정본: `_workspace/20_…plan.md`(설계) · `_workspace/21_…impl.md`(구현)
> 방식: **2-렌즈 적대 검증(qa-verifier ×2 병렬, 전부 READ-ONLY)** + 오케스트레이터 직접 재현(클린 트리, ground truth).
> 결론: **구현 정확. 머지 가능(블로킹 0).** 웹 회귀 0 증명 + 네이티브 어댑터 API를 실제 플러그인 타입과 정적 정합 확인. 디바이스 e2e(iOS/실기기)는 [디바이스] 핸드오프.

## 1. 오케스트레이터 Ground Truth (클린 트리 직접 실행)

| 항목 | 결과 |
|------|------|
| `npx tsc -b --force` | **exit 0** (진단 스테일 노이즈는 파일 생성 전 스냅샷 — 강제 클린 빌드로 무효 확인. `AuthProvider`의 `Capacitor.isNativePlatform()`는 실제 사용됨 line 98·115) |
| `npx vitest run` (전체) | **44 파일 / 345 테스트 전부 통과, exit 0** (이전 40/300 → +4파일/+45테스트, 기존 회귀 0. 부하성 flaky 없음) |
| `npm run build` (tsc+vite) | **exit 0** (플러그인 웹 스텁은 별도 tiny 청크로 분리, 초기 청크 431KB 무증가) |
| `npx cap sync android` | **성공** (8 플러그인 링크 — 신규 4종 포함, SocialLogin Google/Apple enabled) |
| 변경금지 `git diff main..HEAD` | **무변경** — `src/lib/supabase.ts`·`main.tsx`·`state/**`(`sync-repository.ts` 포함)·`domain/**`·`AuthGate.tsx`·`LoginScreen.tsx`·`strings.xml`·`capacitor.config.ts` |

> 변경 표면: 15파일(+1146/−22). gradle 변경은 `cap sync` 산출물(신규 플러그인 링크)로 정당. 새 의존성 4종만(무관 리팩토링 0).

## 2. 렌즈별 판정

| 렌즈 | 판정 | 핵심 근거 |
|------|------|----------|
| **A 웹 회귀·플랫폼 가드·보안·범위** | **PASS** | 모든 네이티브 경로 `Capacitor.isNativePlatform()` 가드 뒤(웹 else=기존 `signInWithOAuth` 문자 그대로). 네이티브 sign-in 플러그인 **동적 `import()` 전용**(top-level 정적 import 0)→웹 번들 격리. `net.ts` 시그니처 불변(`isOnline():boolean`·`onOnline(cb)`)+소비자 `sync-repository.ts` diff 비어있음→PR⑤ 회귀 0. 시크릿 리터럴 0(clientId=`import.meta.env.VITE_*`). local-mode `!supabase` no-op(안티-브릭). `deepLinkAuth.ts` import 0건(순수). AndroidManifest BROWSABLE intent-filter 정확. |
| **B 파서·어댑터 API·vacuity** | **PASS** | 실제 설치본 `.d.ts` 교차: **Apple** `authorize({clientId,redirectURI,scopes,nonce:hash})`+`response.identityToken` 일치, nonce SHA-256 흐름 정확. **capgo Google** `initialize` 선행+`login({provider,options:{nonce}})`+**online/offline 판별 유니온 가드로 `idToken` 안전추출**(offline이면 throw)→디바이스에서만 터질 크래시 정적 차단. **`signInWithIdToken({provider,token,nonce})`** shape이 auth-js 타입 일치(raw nonce forward). 파서 우선순위 error>code>tokens>none + `new URL` 실패 방어. 테스트 non-tautological(`toHaveBeenCalledWith`/`.toEqual` 정확매칭). |

## 3. 4구획 이행 결과

- **구획1 [Claude 완결·웹 vitest]:** 딥링크 파서·AuthProvider 네이티브 분기·nativeSignIn 어댑터·net.ts 네이티브 감지·native.ts 리스너 — 전부 구현 + 테스트 그린. **검증 완료.**
- **구획2 [새 의존성]:** 4종 설치·웹 빌드 그린·cap sync 링크 확인. **검증 완료.**
- **구획3 [파일은 Claude·검증은 디바이스]:** AndroidManifest BROWSABLE intent-filter 추가(정적 정확). `cap sync android` 성공. **실기기 딥링크 왕복은 [디바이스].**
- **구획4 [Claude 불가]:** iOS 빌드(Mac)·Apple/Google 콘솔·Supabase Redirect URL·실기기 e2e → **핸드오프 체크리스트**(§21 로그 §7·§9, 본 PR 본문).

## 4. 웹 회귀 0 게이트 (AC-5·8·9·12) — 전부 그린

- **AC-5** 웹 sign-in은 기존 `signInWithOAuth` 그대로(회귀 0) — `AuthProvider.native.test` 웹 mock에서 네이티브 어댑터 미호출 단언.
- **AC-8** local-mode(`!supabase`) 네이티브 분기 no-op — 테스트 커버.
- **AC-9** `net.ts` 시그니처 불변, 네이티브 `@capacitor/network` 캐시로 동기 `isOnline()` 유지, 웹 `navigator.onLine` 폴백 — 소비자 무변경.
- **AC-12** `npm run build`+`npm test`(44/345) 그린, `cap sync android` 성공.

## 5. 관찰 (전부 비블로킹)

| # | 관찰 | 판정 |
|---|------|------|
| O1 | `@capacitor-community/apple-sign-in@7.1.0` — 계획 §구획2 "8-호환 태그" 제안과 major 상이 | 무해. 7.x가 최신 stable·Capacitor 8 호환·cap sync 정상 링크(impl §4.1 문서화). 향후 8.x stable 시 정렬 검토. |
| O2 | impl 로그 §21 line 74의 Google nonce 서술이 실제 어댑터(항상 raw nonce 반환)와 어긋남 | **문서만 부정확·코드 정상**. QA 후 로그 문구 정정 완료. |
| O3 | `native.test` error-케이스의 의도된 `console.warn` | 기능 이슈 아님(vitest 그린). |

## 6. 미검증 ([디바이스]·판정 대상 외)

- **N5** Android 딥링크 왕복(브라우저→앱 복귀→세션), **N7** 실기기 Apple/Google 네이티브 시트·세션 유지, **AC-10/11/13** 런타임 — 실기기/에뮬레이터·계정 필요(Claude 불가).
- **iOS**: `ios/` 미존재(Mac 필요). Info.plist `CFBundleURLTypes` + Sign in with Apple capability 지침을 §21 로그 §7에 문서로 제공.
- 정적으로 잡을 수 있는 API shape·파서·가드·계층은 위에서 전부 검증됨 → 디바이스 검증은 "콘솔 설정 + 실행"만 남음(코드 결함 리스크 최소).

## 7. 결론

PR⑥은 웹에서 정확하고 CI-안전하다. 모든 네이티브 경로가 `isNativePlatform()` 가드 + 동적 import로 격리되어 **웹 회귀 0**(345 그린·build 0·변경금지 무변경)이 증명됐고, 네이티브 어댑터 API·nonce 흐름·`signInWithIdToken` shape이 **실제 플러그인/auth-js 타입과 정적 정합**한다(디바이스에서만 터질 shape 버그를 정적으로 차단 — 특히 capgo online/offline 유니온 가드). **블로킹 0 → 자동 머지 게이트(`Build & Test (web)`) 통과 가능.** 네이티브 런타임 e2e는 사용자 콘솔 설정 + Mac/디바이스 핸드오프.

## 8. 사용자 핸드오프 체크리스트 (네이티브 활성화 — §9)

- [ ] (Google) iOS/Android OAuth 클라이언트 ID 생성(번들ID·SHA-1) → Supabase Google provider 등록 → `VITE_GOOGLE_*` env 주입.
- [ ] (Apple) Apple Developer($99/년) → App ID + Sign in with Apple → Service ID/Key → Supabase Apple provider 등록 → `VITE_APPLE_*` env 주입.
- [ ] (Supabase) Auth → URL Configuration → Redirect URLs에 `com.chordsalon.app://auth-callback` 추가(웹 origin 유지).
- [ ] (iOS·Mac) `cap add ios` → Info.plist `CFBundleURLTypes` 스킴 + Sign in with Apple capability → Xcode 서명.
- [ ] (Android) `cap sync android` 후 빌드 → 실기기 딥링크 왕복 e2e.
