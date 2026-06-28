### Chordex 모바일 (Capacitor)

이 문서는 웹앱(`dist/`)을 **Capacitor**로 감싼 네이티브 앱(iOS/Android)의 빌드·실행 방법을 정리한다.
앱 정체성: appId `com.chordsalon.app`, 앱 이름 `Chordex`. 설정은 `capacitor.config.ts`.

#### 한눈에

웹을 빌드(`dist/`)한 뒤 Capacitor가 그 산출물을 네이티브 WebView로 감싼다. 코드는 하나(React/Vite),
플랫폼만 추가한다. 현재 **Android 프로젝트(`android/`)가 추가**되어 있고, iOS는 Mac에서 추가한다.

#### npm 스크립트

| 명령 | 동작 |
|------|------|
| `npm run cap:build` | 웹 빌드(`npm run build`) → `cap sync` (모든 플랫폼에 dist 반영) |
| `npm run cap:sync` | 빌드 없이 현재 `dist/`만 네이티브로 동기화 |
| `npm run cap:android` | 웹 빌드 → android 동기화 → Android Studio 열기 |
| `npm run cap:assets` | `assets/`의 소스 이미지로 아이콘/스플래시 생성(아래 참조) |

#### Android 빌드 (요구사항)

`android/` 프로젝트는 이미 생성되어 있다. **실제 빌드/실행**에는 아래가 필요하다(현재 개발 PC 미충족):

- **JDK 17 이상** (현재 PC는 JDK 1.8 — Android Gradle Plugin 8.x는 JDK 17 필요). Android Studio가 JDK 17을 번들로 제공한다.
- **Android SDK** (`ANDROID_HOME` 설정). Android Studio 설치 시 함께 구성된다.

절차:

1. `npm run cap:build` — 최신 웹을 네이티브로 반영
2. `npm run cap:android` — Android Studio에서 `android/` 열기
3. Android Studio에서 기기/에뮬레이터 선택 → Run. 또는 CLI: `cd android && ./gradlew assembleDebug` (JDK 17 + SDK 필요)
4. 스토어 배포용 AAB: `./gradlew bundleRelease` (서명 키 설정 필요)

#### 실기기에서 개발 서버 라이브 보기 (선택)

`capacitor.config.ts`의 주석 처리된 `server.url`을 PC의 LAN IP(`http://<IP>:5173`)로 바꾸면
번들된 `dist` 대신 Vite dev 서버를 실기기에서 바로 볼 수 있다. **배포 빌드 전 반드시 다시 주석 처리.**

#### iOS (Mac 필요)

iOS는 macOS + Xcode에서만 추가·빌드된다(Windows 불가). Mac에서:

1. `npm i` 후 `npx cap add ios`
2. `npm run cap:build`
3. `npx cap open ios` → Xcode에서 서명/프로비저닝 후 실행
4. 스토어 배포 시 Apple Developer Program($99/년) + "Apple로 로그인"(소셜 로그인 도입 시 필수)

#### 아이콘 / 스플래시

`@capacitor/assets`로 생성한다. `assets/` 폴더에 소스 이미지를 두고 `npm run cap:assets` 실행:

```
assets/
  icon-only.png        # 1024x1024 이상
  icon-foreground.png  # (선택) 적응형 아이콘 전경
  icon-background.png  # (선택) 적응형 아이콘 배경
  splash.png           # 2732x2732 이상
  splash-dark.png      # (선택) 다크 스플래시
```

생성 결과는 `android/`(과 iOS 추가 시 `ios/`)에 자동 복사된다. 아직 소스 이미지가 없으면 후속 작업으로 추가한다.

#### 네이티브 초기화

`src/native.ts`가 네이티브에서만 StatusBar/SplashScreen을 초기화한다(웹에서는 no-op).
Android 하드웨어 뒤로가기는 `src/App.tsx`에서 처리(모달 닫기 → 홈 → 종료).
세이프 에어리어/상태바 색은 `src/styles`·`index.html`에 반영되어 있다.
