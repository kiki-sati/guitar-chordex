---
name: react-tdd-implementation
description: "guitar-chordex의 React/TypeScript 기능을 TDD로 구현한다. architect 계획을 받아 실패하는 테스트→최소 구현→통과→리팩터 사이클로 컴포넌트/훅/도메인 로직을 작성. React 컴포넌트·훅·도메인 모듈 구현, 기능 코딩, 버그 수정, QA 피드백 반영이 필요할 때 반드시 사용."
---

# React TDD Implementation — 테스트 주도 구현

architect의 계획을 동작하는 코드로 만든다. TDD를 쓰는 이유: 테스트를 먼저 쓰면 데이터 계약(입출력 shape)을 구현 전에 고정하게 되어, 경계면 불일치 버그가 구조적으로 줄어든다.

## TDD 사이클 (단계마다 반복)

1. **Red** — 계획의 한 단위에 대해 실패하는 테스트를 먼저 작성한다. 테스트는 수용 기준을 코드로 옮긴 것이다.
2. **Green** — 테스트를 통과시키는 **최소한의** 코드를 작성한다. 과도하게 미리 만들지 않는다.
3. **Refactor** — 테스트가 통과하는 상태를 유지하며 중복 제거·정리한다.
4. 한 모듈이 끝나면 `qa-verifier`에게 검증을 요청한다(점진적 QA).

## 무엇을 어떻게 테스트하나

**도메인 로직(`src/lib`/`src/domain`) — 가장 먼저, 가장 철저히:**
순수 함수이므로 입출력만 검증하면 된다. 코드 계산·진행 생성 같은 음악 로직의 정확성을 여기서 잡는다.
```typescript
import { describe, it, expect } from 'vitest';
import { getChord } from './chords';

describe('getChord', () => {
  it('returns voicing with 6 strings for a known chord', () => {
    const chord = getChord('C');
    expect(chord?.voicings[0].strings).toHaveLength(6);
  });
  it('returns null for an unknown chord', () => {
    expect(getChord('Zsus99')).toBeNull();
  });
});
```

**컴포넌트 — React Testing Library로 사용자 관점 검증:**
구현 세부가 아니라 화면에 무엇이 보이고 상호작용이 어떻게 되는지를 테스트한다.
```typescript
import { render, screen } from '@testing-library/react';
import { ChordDiagram } from './ChordDiagram';

it('renders 6 strings of the diagram', () => {
  render(<ChordDiagram chord={cMajor} />);
  expect(screen.getAllByTestId('string-line')).toHaveLength(6);
});
```

## 타입 안전성 — 우회 금지
- `any`, 무분별한 `as` 단언, 의미 없는 제네릭 캐스팅으로 컴파일러를 속이지 않는다. 이는 빌드는 통과하지만 런타임에 깨지는 경계면 버그의 원천이다.
- 타입이 맞지 않으면 그것은 설계 신호다 — 억지로 캐스팅하지 말고 `architect`에게 확인한다.
- architect 계획의 타입 정의를 **그대로** 사용한다. 임의로 필드명을 바꾸면(camelCase↔snake_case 등) 소비자와 어긋난다.

## 그린필드 셋업
계획이 스캐폴딩을 지시하면:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```
`vite.config.ts`에 Vitest(jsdom 환경) 설정을 추가하고, `package.json`에 `"test": "vitest"` 스크립트를 둔다. 셋업 후 `npm test`로 빈 테스트가 도는지 확인하고 구현을 시작한다.

## 검증 실행
- 단위 완성마다 `npm test`로 관련 테스트를 돌린다.
- 타입은 `npx tsc --noEmit`로 확인한다.
- 실패 출력을 임의로 무시하거나 테스트를 약화시키지 않는다. 막히면 근본 원인을 추적한다.

## 출력
- 소스 코드(컴포넌트/훅/도메인 모듈/타입) + 테스트 파일.
- `_workspace/02_implementer_log.md`에 단계별 구현 내역(파일 목록 + 테스트 통과 여부)을 기록한다.

## 원칙
- 계획에서 벗어나야 한다면 코드를 먼저 쓰지 말고 architect에게 확인한다.
- 작은 단위로 자주 검증한다 — 한 번에 큰 덩어리를 구현하면 QA도 디버깅도 어렵다.
