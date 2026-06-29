# QA 리포트: PR④ `feat/web-auth-gate` — 웹 인증 + 로그인 게이트

> 정본: `_workspace/14_pr_web_auth_gate_plan.md`(설계) · `_workspace/15_…impl.md`(구현)
> 방식: **4-렌즈 적대 검증(workflow, qa-verifier ×4 병렬)** + 오케스트레이터 직접 재현.
> 결론: **auth 구현은 정확함. 머지 가능(블로킹 0).** 발견된 실제 이슈 2건은 코드/테스트에 수정 반영, 1건은 별도 PR로 분리.

## 1. 렌즈별 판정

| 렌즈 | 판정 | 핵심 |
|------|------|------|
| ① supabase-js API 계약 | **pass** | 5개 호출 shape 전부 실제 `@supabase/auth-js v2.108.2` 타입과 일치(`getSession`/`onAuthStateChange`/`signInWithOAuth`/`signInWithOtp`(emailRedirectTo)/`signOut`). `tsc -b`가 실제 타입으로 검증(mock이 거짓말 안 함). |
| ② 테스트 무의미성 감사 | pass-with-notes | 9개 변이로 각 AC가 실제 보호됨 확인. **실제 결함 1건**: substring 매처 false-green(아래 F1). |
| ③ 범위·회귀·규칙 | pass-with-notes | 변경금지 파일 무변경·계층 분리·시크릿 0·토큰 사용 OK. "major"는 동시 변이 프로세스로 인한 **회귀 미검증**(아래에서 클린 재실행으로 해소). |
| ④ 정확성·레이스 | fail→해소 | **"참조 구현은 정확"**(probe 1·3·4·5·6·7 전부 통과). fail 사유는 **테스트 하네스 비결정성**(워크트리+동시변이)과 작업트리 변이(되돌려짐). 실제 코드 레이스 1건(아래 F2). |

## 2. 실제 조치 항목 — 신호와 자기유발 잡음 분리

| ID | 항목 | 출처 | 조치 |
|----|------|------|------|
| **자기유발** | 작업트리 변이(`// MUTANT`)·런투런 비결정 | **오케스트레이터 실수**: 4개 풀-도구 에이전트를 단일 작업트리에서 병렬 실행, 1개가 변이 테스트하며 소스 편집 → 다른 에이전트와 상호 오염 | **해소**: `grep -rn MUTANT src/`=∅, `tsc -b`=0, 클린 마커 전부 존재. 클린·유휴 상태 재실행에서 결정적 그린 |
| **F1** | `toHaveTextContent('authenticated')` substring false-green (`'unauthenticated'.includes('authenticated')===true`) → AuthProvider 단위테스트 2개가 잘못된 상태에서도 통과(AC는 AuthGate 레이어가 보호 중) | 렌즈② major | **수정**: `AuthProvider.test.tsx` 2곳을 `.textContent).toBe('authenticated')` 정확매칭으로 교체 |
| **F2** | `getSession`↔`onAuthStateChange` 순서 역전 레이스 — 늦게 resolve된 `getSession`(null)이 먼저 발화한 `SIGNED_IN`을 덮어쓸 수 있음 | 렌즈④ minor | **수정**: `AuthProvider.tsx` effect에 `settledByEvent` 가드 추가(이벤트가 먼저 확정하면 getSession 결과 무시). 테스트 호환 확인 |
| **별도 PR** | vitest가 `.claude/worktrees/**`를 제외하지 않아 stale 워크트리 복사본 중복 수집 → 로컬 풀 실행 부풀림/플래키 | 렌즈④ blocking | **PR④ 범위 아님**: CI는 fresh checkout이라 무영향(아래 §3에서 결정성 입증). 기존 `chore/vitest-exclude-claude` 칩(별도 PR)이 담당. CLAUDE.md "작업단위 PR 분리" 준수 |

> 렌즈④ "blocking" 2건은 모두 (a) 테스트 하네스 비결정성과 (b) 되돌려진 변이에 관한 것이며, **auth 소스 자체의 결함이 아니다**(렌즈 본문: "the reference auth implementation is correct"). a는 워크트리(별도 PR)·동시 에이전트(자기유발) 탓, b는 클린 확인으로 해소.

## 3. 최종 검증 (오케스트레이터, 클린·유휴 상태)

| 항목 | 결과 |
|------|------|
| `npx tsc -b` | **exit 0** (F1/F2 수정 후) |
| `npm test` (CI 동등 — `--exclude .claude`) **2회 반복** | **2/2 결정적: 24파일 / 187테스트 통과, exit 0** → 공유 mock 싱글톤 교차오염이 **CI 조건에서 미발현**(vitest 파일별 격리). CI=fresh checkout=이 조건과 동일 |
| `npm run build` | exit 0 (142 모듈) |
| `grep -rn MUTANT src/` | 빈 결과(변이 잔재 0) |
| 변경금지 파일 | 무변경 |

**결론:** PR④는 정확하고 CI-안전하다. F1·F2 수정 반영, 워크트리-제외는 별도 칩 PR로 분리. 블로킹 0 → 머지 게이트 통과 가능.

## 4. 교훈(하네스 운영)

변이 테스트(소스 편집)를 수행하는 QA 에이전트는 **반드시 워크트리 격리 또는 읽기전용**으로 띄워야 한다. 단일 작업트리에서 다수 풀-도구 에이전트를 병렬 실행하면 상호 오염으로 비결정 신호가 발생한다(이번에 발생 → 클린 재실행으로 해소). 다음 QA 워크플로는 `isolation:'worktree'` 또는 읽기전용 에이전트로 구성.
