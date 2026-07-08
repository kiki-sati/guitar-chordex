import { describe, it, expect } from 'vitest';
import { ko } from '../strings';

/**
 * 모달 톤 정합 수정: 폼별로 생략된 공식 음을 안내하는 문자열.
 * (보이싱 카드 배지 + 상단 캡션 1줄) — ko-only.
 */
describe('i18n ko — chord modal tone-omission keys', () => {
  it('has a caption shown when some voicings omit formula notes', () => {
    expect(ko.tonesOmittedCaption).toBeTruthy();
    expect(typeof ko.tonesOmittedCaption).toBe('string');
  });

  it('formats a per-form omission badge from note names', () => {
    expect(typeof ko.omitBadge).toBe('function');
    expect(ko.omitBadge('G')).toBe('G 생략');
    expect(ko.omitBadge('G, D')).toBe('G, D 생략');
  });
});
