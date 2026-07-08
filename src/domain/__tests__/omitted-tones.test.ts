import { describe, it, expect } from 'vitest';
import { omittedInVoicing } from '../voicing-pcs';

/**
 * 폼별 생략 판정. 명시적 frets 입력이라 allVoicings 출력 순서·구성에 무의존
 * (결정적). OPENPC=[4,9,2,7,11,4], 각 현 (OPENPC[s]+fret)%12.
 */
describe('omittedInVoicing', () => {
  it('C9 open form x30330 omits the 5th (G = pc 7)', () => {
    // s1 f3->0(C); s2 f0->2(D); s3 f3->10(Bb); s4 f3->2(D); s5 f0->4(E)
    // sounded={0,2,10,4}; C9 formula pcs={0,4,7,10,2}; missing 7(G)
    const omitted = omittedInVoicing(0, '9', ['x', 3, 0, 3, 3, 0]);
    expect(omitted.has(7)).toBe(true);
  });

  it('C9 barre-ish form 850056 sounds the 5th -> G not omitted', () => {
    // s0 f8->0(C); s1 f5->2(D); s2 f0->2(D); s3 f0->7(G); s4 f5->4(E); s5 f6->10(Bb)
    // sounded={0,2,7,4,10} = full formula; nothing omitted
    const omitted = omittedInVoicing(0, '9', [8, 5, 0, 0, 5, 6]);
    expect(omitted.has(7)).toBe(false);
    expect(omitted.size).toBe(0);
  });

  it('C major x32010 sounds all of {C,E,G} -> nothing omitted', () => {
    const omitted = omittedInVoicing(0, 'maj', ['x', 3, 2, 0, 1, 0]);
    expect(omitted.size).toBe(0);
  });

  it('fully muted voicing omits every formula note', () => {
    // C major {0,4,7} all absent
    const omitted = omittedInVoicing(0, 'maj', ['x', 'x', 'x', 'x', 'x', 'x']);
    expect([...omitted].sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });
});
