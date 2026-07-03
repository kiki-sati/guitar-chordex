# 구현 로그: PR⑥ `feat/native-auth` — Capacitor 네이티브 인증 + 온라인 감지

> 정본: `_workspace/20_pr_native_auth_plan.md`. 방식: TDD(react-tdd-implementation). 브랜치: `feat/native-auth`.
> 게이트 결과: `npm run build` exit 0 · `npm test` **44 파일 / 345 테스트 전부 그린**(기존 40/300 → +4 파일 / +45 테스트) · `npx cap sync android` 성공(8 플러그인 링크). 웹 회귀 0.

## 1. 파일 맵 (신규/변경/무변경)

### 신규
| 파일 | 역할 |
|---|---|
| `src/auth/deepLinkAuth.ts` | 순수 콜백 파서 `parseAuthCallback(rawUrl): AuthCallback`(판별 유니온). React·Capacitor·supabase 무의존 |
| `src/auth/__tests__/deepLinkAuth.test.ts` | 파서 골든 13케이스(code/tokens/error/none·우선순위·방어) |
| `src/auth/nativeSignIn.ts` | Apple/Google 네이티브 어댑터. 플러그인 **동적 import** + idToken(+nonce) 정규화 |
| `src/auth/__tests__/nativeSignIn.test.ts` | 어댑터 8케이스(토큰 정규화·nonce 해시·취소 throw) |
| `src/auth/__tests__/AuthProvider.native.test.tsx` | 플랫폼 4분기(web-oauth/native-apple/native-google/local-mode) 5케이스 |
| `src/__tests__/native.test.ts` | native.ts 리스너 등록·딥링크 교환·appState 갱신 11케이스 |

### 변경
| 파일 | 변경 내용 |
|---|---|
| `src/auth/AuthProvider.tsx` | `signInWithGoogle/Apple`에 `Capacitor.isNativePlatform()` 분기 추가(네이티브→`signInWithIdToken`, 웹→기존 `signInWithOAuth`). `!supabase` no-op 유지 |
| `src/native.ts` | `initNative`에 `appUrlOpen`·`appStateChange` 리스너 등록(가드·멱등). 딥링크 결과별 supabase 교환 + `Browser.close()` |
| `src/sync/net.ts` | 네이티브 `@capacitor/network` getStatus 캐시 + `networkStatusChange` 리스너. 웹 폴백 유지. **`isOnline()`/`onOnline()` 시그니처 불변** |
| `src/sync/__tests__/net.test.ts` | 웹 케이스 유지 + 네이티브 케이스 확장(총 14) |
| `src/vite-env.d.ts` | `VITE_APPLE_CLIENT_ID`/`VITE_APPLE_REDIRECT_URI`/`VITE_GOOGLE_IOS_CLIENT_ID`/`VITE_GOOGLE_WEB_CLIENT_ID` 타입 추가 |
| `.env.example` | 네이티브 sign-in 4개 env 문서화(웹 미사용, 미설정 무영향) |
| `android/app/src/main/AndroidManifest.xml` | `MainActivity`에 BROWSABLE VIEW intent-filter 추가(`@string/custom_url_scheme`) |
| `android/capacitor.settings.gradle`·`android/app/capacitor.build.gradle` | `cap sync android`가 4개 신규 플러그인(+preferences) 등록(생성 산출물) |

### 무변경(명시 — 손대지 않음, 회귀 0)
`src/lib/supabase.ts`(이미 네이티브 대비 완료) · `src/main.tsx` · `src/state/**`(PR⑤ 동기화) · `src/domain/**` · `src/auth/AuthGate.tsx`/`LoginScreen.tsx` · `android/.../strings.xml`(custom_url_scheme 이미 존재) · `capacitor.config.ts`.

## 2. 사용한 플러그인 API (실제 node_modules 타입 기준 — idToken 획득 방식)

계획 §2.2 가정 대비 **실제 타입에 맞춰 배선**했다. 편차는 §4에 명시.

### Apple — `@capacitor-community/apple-sign-in` (`^7.1.0`, 설치본)
- 호출: `SignInWithApple.authorize({ clientId, redirectURI, scopes, nonce })`.
- 반환: `{ response: { identityToken: string, authorizationCode, user, email, ... } }`.
- **idToken 획득**: `response.identityToken`. `identityToken`이 빈 문자열이면 throw.
- **nonce 처리(R6)**: 어댑터가 raw nonce를 생성 → **SHA-256 hex 해시**를 `authorize({ nonce })`에 전달, **raw nonce는 반환 객체에 담아** AuthProvider가 `signInWithIdToken({ nonce: rawNonce })`로 넘긴다. (supabase가 raw nonce를 해시해 idToken의 nonce 클레임과 대조 → Apple 로그인 성공 조건.)

### Google — `@capgo/capacitor-social-login` (`^8.3.31`, 설치본)
- 초기화: `SocialLogin.initialize({ google: { iOSClientId, webClientId } })`.
- 로그인: `SocialLogin.login({ provider: 'google', options: { nonce } })`.
- 반환: `{ provider:'google', result: GoogleLoginResponse }`. 온라인 응답만 `idToken`을 가짐(`responseType:'online'`); offline은 `serverAuthCode`만.
- **idToken 획득**: `result.idToken`(단, `result.responseType === 'online'`일 때만). 아니면 throw.
- **nonce**: capgo가 `options.nonce`(raw)를 받아 토큰에 반영 → 어댑터가 같은 raw nonce를 반환, AuthProvider가 `signInWithIdToken({ nonce })`로 전달.
- 취소: capgo는 `USER_CANCELLED` 코드로 reject → 어댑터가 그대로 전파(throw).

### Network — `@capacitor/network` (`^8.0.1`)
- `Network.getStatus(): Promise<{connected, connectionType}>`(비동기) — 모듈 로드 시 1회 캐시.
- `Network.addListener('networkStatusChange', cb)` — 상태 변화 시 캐시 갱신 + false→true 전이에서 `onOnline` cb 발화.

### App — `@capacitor/app` (`^8.1.0`, 기존 설치)
- `App.addListener('appUrlOpen', ({url}) => ...)` — 딥링크 URL.
- `App.addListener('appStateChange', ({isActive}) => ...)` — 포그라운드/백그라운드.

### Browser — `@capacitor/browser` (`^8.0.3`)
- `Browser.close()` — 딥링크 콜백 처리 후 폴백 브라우저 닫기(없으면 try/catch 무시).

### Supabase auth (기존 client)
- `exchangeCodeForSession(code)`(PKCE) · `setSession({access_token, refresh_token})`(implicit) · `signInWithIdToken({provider, token, nonce?})`(네이티브) · `startAutoRefresh()`/`stopAutoRefresh()`(appState).

## 3. 계층 분리 준수
- **파서(`deepLinkAuth.ts`)**: supabase·Capacitor·React 무의존(순수). "무엇을 교환할지"만 판별.
- **어댑터(`nativeSignIn.ts`)**: 플러그인만 알고 supabase 무의존. idToken(+nonce) 정규화 반환.
- **supabase 접근**: `AuthProvider`(sign-in)와 `native.ts`(딥링크 교환·auto-refresh)만 소유.
- 네이티브 sign-in 플러그인은 **동적 `import()`** 로만 로드 → 빌드 산출물에서 별도 `web-*.js` 청크로 분리(초기 청크 미포함 확인).

## 4. 계획 대비 편차
1. **Apple 플러그인 버전**: 계획 §구획2는 "8-호환 태그" 제안. 실제 설치본은 `@capacitor-community/apple-sign-in@7.1.0`. `cap sync android`에서 정상 링크되고 API(`authorize`)는 계획 가정과 동일하므로 그대로 사용. (이 플러그인의 최신 안정 태그가 7.x. Capacitor 8과 호환.)
2. **Google 플러그인 API 형태**: 계획은 "idToken 반환" 가정. 실제 capgo는 **`initialize` 선행 필수** + 응답이 online/offline 판별 유니온. 어댑터에서 `initialize` 호출 후 `responseType==='online'` 가드로 idToken을 안전 추출(offline이면 throw)하도록 배선.
3. **nonce 흐름 명확화**: 계획 §2.2는 "Apple raw nonce" 언급. 실제 구현은 **Apple=해시 전달/raw 반환**, **Google=raw 전달/raw 반환**으로 각 플러그인 규약에 맞춰 정규화. 둘 다 raw nonce를 반환하고 `AuthProvider`가 어댑터 반환 nonce를 `signInWithIdToken({nonce})`에 그대로 forward한다(Apple=raw, Google=raw). `AuthProvider.native.test`는 어댑터를 nonce 없이 mock해 "반환 nonce를 그대로 전달"만 격리 검증하고, Google의 실제 raw-nonce 왕복은 `nativeSignIn.test`가 별도 커버.
4. **env 설정 추가**: 콘솔 발급 값(clientId/webClientId 등)을 하드코딩할 수 없어 `import.meta.env.VITE_*`로 주입하고 `vite-env.d.ts`·`.env.example`에 문서화(기존 supabase env 패턴과 동일). 미설정이어도 웹 빌드·테스트 무영향.
5. **net.ts 리스너 등록 순서**: `addListener`를 `getStatus` await **전에** 등록(로드 직후 상태 변화 유실 방지 + 테스트 결정성). 동작·시그니처 영향 없음.

## 5. 검증 결과 (exit code · 테스트 수)
| 단계 | 명령 | 결과 |
|---|---|---|
| A 파서 | `vitest run deepLinkAuth.test` | 13 passed |
| B net | `vitest run net.test` | 14 passed |
| C 어댑터+분기 | `vitest run nativeSignIn.test + AuthProvider.native.test + AuthProvider.test` | 8+5+11 passed(회귀 0) |
| D native | `vitest run native.test` | 11 passed |
| — 타입 | `npx tsc -b` | **exit 0** |
| F 빌드 게이트 | `npm run build` (tsc+vite) | **exit 0** (native sign-in 플러그인 별도 `web-*.js` 청크 분리 확인) |
| F 테스트 게이트 | `npm test` (전 파일) | **44 파일 / 345 테스트 passed** (이전 40/300 대비 회귀 0) |
| E cap sync | `npx cap sync android` | **성공** — 8 플러그인 링크, SocialLogin Google/Apple/Facebook/Twitter enabled, web assets 복사 |

> AC-5/8/9/12(웹 회귀 0 게이트) 전부 그린. AC-1~4(파서)·AC-6/7(플랫폼 분기)·AC-13(appState 등록) 웹 vitest로 검증됨. AC-10/11(실기기 e2e)·N7은 [디바이스] — 아래 핸드오프.

## 6. 변경 금지(무변경) 확인
`git diff`로 아래가 변경되지 않았음을 확인: `src/lib/supabase.ts` · `src/main.tsx` · `src/state/**` · `src/domain/**` · `src/auth/AuthGate.tsx`/`LoginScreen.tsx` · `android/.../strings.xml` · `capacitor.config.ts`. net.ts 소비자 `src/state/sync-repository.ts`는 `isOnline`/`onOnline`만 사용 → 시그니처 불변으로 무변경(PR⑤ 회귀 0).

## 7. iOS Info.plist 핸드오프 지침 (`ios/` 미존재 — 파일 작성 불가, Mac 필요)

Mac에서 `npx cap add ios` 후, `ios/App/App/Info.plist`에 **커스텀 URL 스킴**을 추가한다(딥링크 콜백 수신):

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.chordsalon.app</string>
        </array>
    </dict>
</array>
```

추가로 iOS Apple/Google 네이티브 로그인용:
- **Sign in with Apple**: Xcode → target → Signing & Capabilities → **+ Capability → Sign in with Apple** 추가.
- **Google(iOS)**: `Info.plist`에 Google iOS 클라이언트의 **reversed client ID**를 별도 `CFBundleURLSchemes` 항목으로 추가(GoogleService-Info 또는 콘솔 발급값). capgo 문서 기준.
- 빌드/서명/프로비저닝은 Xcode에서(§9.5). `npx cap sync ios` 후 실기기 테스트.

## 8. §9 사용자 콘솔 체크리스트 (착수 후 — [디바이스] 활성화 전제)

- [ ] **(§9.2 Google)** Google Cloud에서 iOS/Android용 OAuth 클라이언트 ID 생성(iOS=번들ID `com.chordsalon.app`, Android=패키지+SHA-1). Web 클라이언트 ID도 생성. Supabase Google provider에 등록. → `VITE_GOOGLE_IOS_CLIENT_ID`·`VITE_GOOGLE_WEB_CLIENT_ID`.
- [ ] **(§9.3 Apple)** Apple Developer 가입($99/년) → App ID(`com.chordsalon.app`) + "Sign in with Apple" capability → Service ID + Key(.p8) 발급 → Supabase Apple provider 등록. → `VITE_APPLE_CLIENT_ID`(Service ID)·`VITE_APPLE_REDIRECT_URI`.
- [ ] **(§9.4)** Supabase Auth → URL Configuration → Redirect URLs에 `com.chordsalon.app://auth-callback` 추가(웹 origin 유지).
- [ ] **(§9.5)** Mac에서 `npx cap add ios` → 위 Info.plist 스킴 + Sign in with Apple capability → Xcode 서명. Android는 Windows에서 `npx cap sync android` 후 Android Studio 빌드(이미 sync 성공).
- [ ] 네이티브 sign-in 플러그인 설치 완료(설치·커밋됨) → `npx cap sync` 재실행(iOS 추가 시).

### §9 콘솔/디바이스 검증 체크리스트 (QA·사용자용)
- [ ] **N5 [디바이스]**: Android BROWSABLE intent-filter로 `com.chordsalon.app://auth-callback` 딥링크가 앱(기존 인스턴스, singleTask)으로 전달되는지.
- [ ] **N7 [디바이스·iOS]**: "Apple로 계속" → 네이티브 시트 → 로그인 성공 → 세션 유지(AC-10).
- [ ] **N7 [디바이스·Android]**: "Google로 계속" → 네이티브 시트 → 로그인 성공. 딥링크 폴백 왕복(브라우저→앱 복귀→세션)(AC-11).
- [ ] **[디바이스]**: 앱 포그라운드 복귀 시 토큰 자동 갱신 실동작(AC-13 런타임).
- [ ] **[디바이스]**: 네이티브 오프라인/온라인 전이 시 동기화 재개(net.ts getStatus/listener 실동작).

## 9. 잔여 이슈 / 주의
- **[디바이스] cap sync ios 미검증**: `ios/` 미존재(Windows). iOS는 지침 문서만 제공(§7). cap sync android는 성공.
- **콘솔 값 미주입**: `VITE_*` 네이티브 sign-in env가 비어 있으면 네이티브 로그인은 플러그인 레벨에서 실패(설계상 콘솔 설정 후 활성화). 웹·local-mode는 무영향.
- **PowerShell stderr 경고**: native.test의 error-케이스가 `console.warn`(의도된 로깅)을 출력 → PowerShell이 NativeCommandError로 표기하나 vitest는 그린(11 passed). 실패 아님.
