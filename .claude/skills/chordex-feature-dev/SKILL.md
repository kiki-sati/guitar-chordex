---
name: chordex-feature-dev
description: "guitar-chordex 기타 코드 웹앱(TypeScript+React)의 기능 개발을 에이전트 팀(설계→구현→검증)으로 조율하는 오케스트레이터. 새 기능 개발·구현, 컴포넌트/코드 다이어그램/진행 기능 추가 요청 시 사용. 후속 작업: 기능 수정, 부분 재구현, 업데이트, 보완, 다시 구현, 버그 수정, QA 재검증, 이전 결과 기반 개선 요청 시에도 반드시 이 스킬을 사용. 단순 질문은 직접 응답 가능."
---

# Chordex Feature Dev Orchestrator

guitar-chordex의 기능 개발을 **설계자 → 구현자 → 검증자** 에이전트 팀으로 조율하여, 동작이 검증된 기능 코드를 산출하는 통합 스킬.

## 실행 모드: 에이전트 팀

생성-검증 파이프라인이지만, 설계자↔구현자↔검증자 간 실시간 피드백 루프(설계 모호성 질의, 경계면 불일치 즉시 수정)가 품질의 핵심이므로 에이전트 팀으로 구성한다.

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 스킬 | 출력 |
|------|-------------|------|------|------|
| architect | `architect` (커스텀) | 요구 분석 + 컴포넌트/데이터 설계 + 구현 계획 | feature-architecture | `_workspace/01_architect_plan.md` |
| implementer | `implementer` (커스텀) | TDD 기반 React/TS 구현 | react-tdd-implementation | 소스 코드 + `_workspace/02_implementer_log.md` |
| qa-verifier | `qa-verifier` (커스텀, 풀 도구) | 통합 정합성·도메인·테스트 검증 | integration-qa | `_workspace/03_qa_report.md` |

모든 팀원은 `model: "opus"`로 생성한다.

## 워크플로우

### Phase 0: 컨텍스트 확인 (후속 작업 지원)
기존 산출물 여부로 실행 모드를 결정한다:
1. `_workspace/` 존재 여부 확인
2. 분기:
   - **미존재** → 초기 실행. Phase 1로 진행
   - **존재 + 부분 수정 요청** → 부분 재실행. 해당 팀원만 재호출하고, 이전 산출물 경로를 프롬프트에 포함해 기존 결과를 읽고 수정하도록 지시
   - **존재 + 새 기능 요청** → 새 실행. 기존 `_workspace/`를 `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 새로 생성
3. 부분 재실행 예: "QA만 다시" → qa-verifier만, "코드 다이어그램 설계 바꿔" → architect부터 다시.

### Phase 1: 준비
1. 사용자 기능 요구 분석 — 무엇을 만드는지, 수용 기준 후보 도출
2. `_workspace/` 생성 (새 실행이면 기존 것 이동 후 재생성)
3. 기능 요구·제약을 `_workspace/00_input/request.md`에 저장

### Phase 2: 팀 구성
```
TeamCreate(
  team_name: "chordex-dev-team",
  members: [
    { name: "architect",    agent_type: "architect",    model: "opus",
      prompt: "feature-architecture 스킬로 _workspace/00_input/request.md의 기능을 설계하라. _workspace/01_architect_plan.md에 수용기준·데이터모델·컴포넌트설계·검증경계면·단계별 계획을 작성하고, 완료 시 implementer와 qa-verifier에게 SendMessage로 알려라." },
    { name: "implementer",   agent_type: "implementer",  model: "opus",
      prompt: "react-tdd-implementation 스킬로 architect의 _workspace/01_architect_plan.md를 TDD 구현하라. 한 모듈 완성마다 qa-verifier에게 검증을 요청하라. 계획이 모호하면 architect에게 질의하라." },
    { name: "qa-verifier",   agent_type: "qa-verifier",  model: "opus",
      prompt: "integration-qa 스킬로 통합 정합성·도메인 정확성·테스트를 검증하라. 모듈 완성 직후 점진적으로 검증하고, 이슈는 즉시 해당 팀원에게 파일:라인+수정방법으로 SendMessage하라. _workspace/03_qa_report.md에 리포트를 남겨라." }
  ]
)
```

작업 등록 (의존성 명시):
```
TaskCreate(tasks: [
  { title: "기능 설계",        assignee: "architect" },
  { title: "도메인 모델 확정",  assignee: "architect" },
  { title: "구현(단계별)",      assignee: "implementer", depends_on: ["기능 설계"] },
  { title: "점진적 검증",       assignee: "qa-verifier", depends_on: ["구현(단계별)"] },
  { title: "최종 정합성 검증",  assignee: "qa-verifier" }
])
```

### Phase 3: 설계 → 구현 → 검증 (팀 자체 조율)
**실행 방식:** 팀원들이 공유 작업 목록에서 작업을 요청하고 자체 조율한다.

통신 규칙:
- architect는 계획 완성 시 implementer·qa-verifier에게 경로를 SendMessage
- implementer는 모듈 완성 시 qa-verifier에게 검증 요청(변경 파일 목록)
- qa-verifier는 경계면 이슈를 생산자·소비자 양쪽에게 즉시 통보
- 계획 모호성은 implementer→architect 질의로 즉시 해소

리더(오케스트레이터) 모니터링:
- 팀원 유휴 알림 수신 시 다음 작업 유도
- 막힌 팀원은 SendMessage로 개입하거나 작업 재할당
- 진행률은 TaskGet으로 확인
- **재시도 한계:** 생성↔검증 루프는 최대 3회. 3회 후에도 미해결이면 잔여 이슈를 보고서에 명시하고 진행

### Phase 4: 통합 확인
1. 모든 작업 완료 대기 (TaskGet)
2. `_workspace/03_qa_report.md`의 실패/미검증 항목 확인
3. `npm test`·`npm run build` 최종 통과 여부를 qa-verifier 리포트로 확인
4. 잔여 이슈가 있으면 사용자에게 명확히 보고

### Phase 5: 정리
1. 팀원에게 종료 요청 (SendMessage)
2. 팀 정리 (TeamDelete)
3. `_workspace/` 보존 (감사 추적용)
4. 사용자에게 결과 요약: 구현된 기능, 테스트/빌드 상태, 잔여 이슈, 변경 파일 목록

## 데이터 흐름
```
[리더] → TeamCreate
  architect ──01_architect_plan.md──→ implementer ──소스코드──→ qa-verifier
     ↑                                    ↑   │                     │
     └──────── SendMessage(질의) ─────────┘   └─SendMessage(검증요청)┘
                                              03_qa_report.md
                                                  ↓
                              [리더: 통합 확인 → 사용자 보고]
```

## 에러 핸들링
| 상황 | 전략 |
|------|------|
| 팀원 1명 실패/중지 | 리더가 SendMessage로 상태 확인 → 재시작, 실패 시 작업 재할당 |
| 생성↔검증 무한 루프 | 최대 3회 제한, 이후 잔여 이슈 명시하고 진행 |
| 테스트/빌드 실행 불가 | qa-verifier가 "미검증" 명시, 정적 분석 대체. 통과로 위장 금지 |
| 설계-구현 상충 | architect가 트레이드오프 병기, 사용자 판단 요청 |
| 팀원 간 데이터 충돌 | 출처 병기, 삭제 금지 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "코드 이름을 입력하면 다이어그램을 보여주는 기능 만들어줘"
2. Phase 1: 수용 기준 도출, `_workspace/` 생성
3. Phase 2: 3인 팀 + 5개 작업 구성
4. Phase 3: architect 계획 → implementer TDD 구현 → qa-verifier 점진 검증, SendMessage로 경계면 조율
5. Phase 4: `npm test`·`build` 통과 확인
6. Phase 5: 팀 정리, 결과 보고
7. 예상 결과: 동작하는 컴포넌트·도메인 로직 + 테스트, QA 리포트 통과

### 에러 흐름
1. Phase 3: qa-verifier가 `getChord` 반환 shape과 `<ChordDiagram>` props 불일치 발견
2. 생산자(implementer)·설계 출처(architect) 양쪽에 SendMessage
3. architect가 계약 명확화, implementer가 수정 후 재검증
4. 3회 내 미해결 시 보고서에 "경계면 X 미해결" 명시하고 Phase 4 진행
