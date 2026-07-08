import { OPENPC } from './constants';
import type { FretArray, Fret, Quality, RootIndex } from './types';

/**
 * 무버블 CAGED 쉐입. 값 = 바레 프렛으로부터의 오프셋(0-based), 'x'=뮤트.
 * 루트 현: E쉐입=6번줄(idx0), A쉐입=5번줄(idx1), D쉐입=4번줄(idx2).
 * offsets[rootString] = 그 현에서의 루트 오프셋(대개 0).
 *
 * 이 오프셋 테이블은 chord.ts의 E_SHAPES/A_SHAPES(barre 대표 폼용)와 동일 수치.
 * D쉐입만 신규. chord.ts는 손대지 않고 여기 별도 정의(관심사 분리:
 * barre=대표 폼 전용, template=다형 노출 전용).
 */
export interface MovableShape {
  offsets: FretArray; // 길이 6, 오프셋(0-based) 또는 'x'
  rootString: 0 | 1 | 2; // 루트가 놓이는 현 인덱스 (E/A/D)
}

// rootString → 쉐입명(라벨용). 6번줄=E, 5번줄=A, 4번줄=D.
export const ROOT_STRING_SHAPE = ['E', 'A', 'D'] as const;

// quality별 무버블 CAGED 쉐입. BARRE_OK 6종(sus4 포함) + m7b5(A쉐입 하프디미).
// 확장 코드(9/11/13/dim7/aug…)는 enum 후보가 커버 — 여기 정의하지 않음.
export const CAGED_SHAPES: Partial<Record<Quality, MovableShape[]>> = {
  maj: [
    { offsets: [0, 2, 2, 1, 0, 0], rootString: 0 },
    { offsets: ['x', 0, 2, 2, 2, 0], rootString: 1 },
    { offsets: ['x', 'x', 0, 2, 3, 2], rootString: 2 },
  ],
  min: [
    { offsets: [0, 2, 2, 0, 0, 0], rootString: 0 },
    { offsets: ['x', 0, 2, 2, 1, 0], rootString: 1 },
    { offsets: ['x', 'x', 0, 2, 3, 1], rootString: 2 },
  ],
  '7': [
    { offsets: [0, 2, 0, 1, 0, 0], rootString: 0 },
    { offsets: ['x', 0, 2, 0, 2, 0], rootString: 1 },
    { offsets: ['x', 'x', 0, 2, 1, 2], rootString: 2 },
  ],
  maj7: [
    { offsets: [0, 2, 1, 1, 0, 0], rootString: 0 },
    { offsets: ['x', 0, 2, 1, 2, 0], rootString: 1 },
    { offsets: ['x', 'x', 0, 2, 2, 2], rootString: 2 },
  ],
  m7: [
    { offsets: [0, 2, 0, 0, 0, 0], rootString: 0 },
    { offsets: ['x', 0, 2, 0, 1, 0], rootString: 1 },
    { offsets: ['x', 'x', 0, 2, 1, 1], rootString: 2 },
  ],
  m7b5: [
    // A쉐입 하프디미니시드(보강). rootString=1(5번줄).
    { offsets: ['x', 0, 1, 0, 1, 'x'], rootString: 1 },
  ],
  sus4: [
    { offsets: [0, 2, 2, 2, 0, 0], rootString: 0 },
    { offsets: ['x', 0, 2, 2, 3, 0], rootString: 1 },
  ],
};

/**
 * 무버블 쉐입을 루트로 트랜스포즈 → 실제 프렛 배열(들).
 *
 * 루트 pc가 rootString의 루트 오프셋 위치에 놓이도록 바레 프렛을 산정:
 *   barre = ((root - (OPENPC[rootString] + offsets[rootString])) % 12 + 12) % 12
 * barre, barre+12 두 옥타브를 생성(고포지션 폼 커버). barre가 0이면 개방폼
 * (OPEN 맵과 중복 가능 → dedup에서 흡수).
 *
 * OPENPC=[4,9,2,7,11,4]는 enum의 OPEN_MIDI와 mod 12 동일 → 동일 pc 공간에서
 * 계산되므로 template ↔ enum 폼의 pos/pcs 정합 보장.
 *
 * 순수 함수(입력 동일 → 출력 동일). 결정론적 — 정렬/큐레이션은 호출측 책임.
 */
export function transposeShape(shape: MovableShape, root: RootIndex): FretArray[] {
  const rs = shape.rootString;
  const rootOffset = shape.offsets[rs] as number; // rootString 자리는 항상 숫자
  const barre = (((root - (OPENPC[rs] + rootOffset)) % 12) + 12) % 12;
  const out: FretArray[] = [];
  for (const b of [barre, barre + 12]) {
    const frets: FretArray = shape.offsets.map((o: Fret) =>
      o === 'x' ? 'x' : b + (o as number),
    );
    out.push(frets);
  }
  return out;
}
