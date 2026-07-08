import { describe, it, expect } from 'vitest';
import {
  isInversion,
  bestSlashVoicing,
  allSlashVoicings,
  buildSlashChord,
} from '../slash';
import { chordPCs, requiredPCs, buildChord } from '../chord';
import { bestVoicing } from '../voicing';
import { OPEN_MIDI } from '../constants';
import type { FretArray, Quality, RootIndex } from '../types';

/** NOTE index: C0 C#1 D2 D#3 E4 F5 F#6 G7 G#8 A9 A#10 B11 */
const C = 0, Db = 1, D = 2, Eb = 3, E = 4, F = 5, G = 7, Ab = 8, A = 9, B = 11;

// ── 보이싱 검사 헬퍼 (기존 collect 필터와 동일 정의) ──
function sounded(fr: FretArray): number[] {
  const idx: number[] = [];
  for (let s = 0; s < 6; s++) if (fr[s] !== 'x') idx.push(s);
  return idx;
}
function lowestBassPc(fr: FretArray): number {
  const s = sounded(fr)[0];
  return s === undefined ? -1 : (OPEN_MIDI[s] + (fr[s] as number)) % 12;
}
function isContiguous(fr: FretArray): boolean {
  const idx = sounded(fr);
  if (idx.length === 0) return false;
  for (let s = idx[0]; s <= idx[idx.length - 1]; s++) if (fr[s] === 'x') return false;
  return true;
}
function span(fr: FretArray): number {
  let mn = 99, mx = 0;
  for (const s of sounded(fr)) {
    const f = fr[s] as number;
    if (f > 0) { if (f < mn) mn = f; if (f > mx) mx = f; }
  }
  return mx > 0 ? mx - mn : 0;
}
function pcSet(fr: FretArray): Set<number> {
  const set = new Set<number>();
  for (const s of sounded(fr)) set.add((OPEN_MIDI[s] + (fr[s] as number)) % 12);
  return set;
}
function assertPlayable(fr: FretArray): void {
  expect(fr).toHaveLength(6);
  expect(sounded(fr).length).toBeGreaterThanOrEqual(4); // 비뮤트 ≥ 4
  expect(isContiguous(fr)).toBe(true); // 발음현 사이 뮤트 없음
  expect(span(fr)).toBeLessThanOrEqual(4); // 스팬 ≤ 4
}

describe('isInversion — 전위(코드톤 베이스) vs 온코드(비코드톤)', () => {
  it('G/B → inversion (B ∈ G코드톤)', () => {
    expect(chordPCs(G, 'maj').has(B)).toBe(true);
    expect(isInversion(G, 'maj', B)).toBe(true);
  });
  it('Ab/C → inversion (C ∈ Ab코드톤)', () => {
    expect(isInversion(Ab, 'maj', C)).toBe(true);
  });
  it('C/D → 온코드 (D ∉ C코드톤)', () => {
    expect(chordPCs(C, 'maj').has(D)).toBe(false);
    expect(isInversion(C, 'maj', D)).toBe(false);
  });
  it('A/B → 온코드 (B ∉ A코드톤)', () => {
    expect(isInversion(A, 'maj', B)).toBe(false);
  });
  it('Db/Eb → 온코드 (Eb ∉ Db코드톤)', () => {
    expect(isInversion(Db, 'maj', Eb)).toBe(false);
  });
});

describe('bestSlashVoicing — 최저 발음현 PC === bass PC (연주 가능)', () => {
  const cases: Array<[string, RootIndex, Quality, RootIndex]> = [
    ['G/B (전위)', G, 'maj', B],
    ['Ab/C (전위)', Ab, 'maj', C],
    ['C/E (전위)', C, 'maj', E],
    ['A/B (온코드)', A, 'maj', B],
    ['C/D (온코드)', C, 'maj', D],
    ['Db/Eb (온코드)', Db, 'maj', Eb],
    ['G/F (온코드)', G, 'maj', F],
    ['D/E (온코드)', D, 'maj', E],
  ];
  for (const [label, root, qual, bass] of cases) {
    it(`${label}: 최저현=bass + 연주가능 + 필수음 포함`, () => {
      const fr = bestSlashVoicing(root, qual, bass);
      assertPlayable(fr);
      expect(lowestBassPc(fr)).toBe(bass % 12);
      // 필수음 = requiredPCs(root,qual) ∪ {bass} 포함
      const pcs = pcSet(fr);
      for (const r of requiredPCs(root, qual)) expect(pcs.has(r)).toBe(true);
      expect(pcs.has(bass % 12)).toBe(true);
    });
  }
});

describe('bestSlashVoicing — 12루트 스팟체크 (전위/온코드)', () => {
  // 전위: 각 메이저 트라이어드의 3도를 베이스로 (1st inversion)
  for (let root = 0 as RootIndex; root < 12; root++) {
    const third = (root + 4) % 12;
    it(`전위 ${root}/3rd(${third}): 최저현=3도, 연주가능`, () => {
      expect(isInversion(root, 'maj', third)).toBe(true);
      const fr = bestSlashVoicing(root, 'maj', third);
      assertPlayable(fr);
      expect(lowestBassPc(fr)).toBe(third);
    });
  }
  // 온코드: 각 메이저 트라이어드에 장2도(=9도) 베이스 (비코드톤)
  for (let root = 0 as RootIndex; root < 12; root++) {
    const two = (root + 2) % 12;
    it(`온코드 ${root}/2nd(${two}): 최저현=2도, 연주가능`, () => {
      expect(isInversion(root, 'maj', two)).toBe(false);
      const fr = bestSlashVoicing(root, 'maj', two);
      assertPlayable(fr);
      expect(lowestBassPc(fr)).toBe(two);
    });
  }
});

describe('allSlashVoicings — 각 폼이 bass 제약 + 연주가능', () => {
  it('G/B: 최소 1폼, 모든 폼 최저현=B, 결정론', () => {
    const forms = allSlashVoicings(G, 'maj', B);
    expect(forms.length).toBeGreaterThanOrEqual(1);
    for (const fr of forms) {
      assertPlayable(fr);
      expect(lowestBassPc(fr)).toBe(B);
    }
    // 결정론: 재호출 동일
    expect(allSlashVoicings(G, 'maj', B)).toEqual(forms);
  });
  it('A/B(온코드): 모든 폼 최저현=B', () => {
    const forms = allSlashVoicings(A, 'maj', B);
    expect(forms.length).toBeGreaterThanOrEqual(1);
    for (const fr of forms) {
      assertPlayable(fr);
      expect(lowestBassPc(fr)).toBe(B);
    }
  });
  it('중복 폼 없음(G/B)', () => {
    const forms = allSlashVoicings(G, 'maj', B);
    const keys = forms.map((f) => f.join(','));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('buildSlashChord — Chord shape / 표기 / bass 필드', () => {
  it('G/B: name=G/B, bass=B, root=G, len6', () => {
    const c = buildSlashChord(G, 'maj', B);
    expect(c.name).toBe('G/B');
    expect(c.bass).toBe(B);
    expect(c.root).toBe(G);
    expect(c.qualKey).toBe('maj');
    expect(c.frets).toHaveLength(6);
    expect(c.key).toBe('G/B');
    expect(lowestBassPc(c.frets)).toBe(B);
  });
  it('Gadd2/B: 본체 add9 + 슬래시 표기', () => {
    const c = buildSlashChord(G, 'add9', B);
    expect(c.name).toBe('Gadd9/B'); // SUF['add9']='add9'
    expect(c.bass).toBe(B);
    expect(c.qualKey).toBe('add9');
  });
  it('Ab/C: name=G#/C (canonical NOTE 샤프 표기)', () => {
    const c = buildSlashChord(Ab, 'maj', C);
    expect(c.name).toBe('G#/C');
    expect(c.bass).toBe(C);
  });
  it('C/D 온코드: name=C/D, 최저현=D', () => {
    const c = buildSlashChord(C, 'maj', D);
    expect(c.name).toBe('C/D');
    expect(c.bass).toBe(D);
    expect(lowestBassPc(c.frets)).toBe(D);
  });
  it('bass===root → 슬래시 무의미 → 일반 buildChord (bass 없음)', () => {
    const c = buildSlashChord(C, 'maj', C);
    const plain = buildChord(C, 'maj');
    expect(c.name).toBe(plain.name); // 'C'
    expect(c.bass).toBeUndefined();
    expect(c.frets).toEqual(plain.frets);
  });
});

describe('폴백 — bass 제약 후보 0건이면 bestVoicing (name은 슬래시 유지)', () => {
  // 극단 온코드: 어떤 폼도 제약을 못 맞추는 케이스가 있으면 bestVoicing 반환.
  // 폴백이 발동해도 name은 슬래시, frets는 len6, 연주가능(기존 엔진 산출).
  it('임의 12루트×12베이스 전수: 항상 len6 + name 슬래시 형태', () => {
    for (let root = 0 as RootIndex; root < 12; root++) {
      for (let bass = 0 as RootIndex; bass < 12; bass++) {
        if (bass === root) continue;
        const c = buildSlashChord(root, 'maj', bass);
        expect(c.frets).toHaveLength(6);
        expect(c.name).toContain('/'); // 슬래시 표기 유지
      }
    }
  });
  it('폴백 시에도 frets는 bestVoicing과 동일하거나 bass 제약 충족', () => {
    // 스팟: 만약 폴백이면 bestVoicing과 일치. 아니면 최저현=bass.
    const root = C, qual: Quality = 'maj', bass = D;
    const fr = bestSlashVoicing(root, qual, bass);
    const fb = bestVoicing(root, qual);
    const ok = lowestBassPc(fr) === (bass % 12) || fr.join(',') === fb.join(',');
    expect(ok).toBe(true);
  });
});
