import { describe, it, expect } from 'vitest';
import { ko } from '../strings';

/**
 * 모달 톤 칩 정합 수정: 일부 폼에서 생략되는 공식 음을 안내하는 문자열.
 * (칩 title 툴팁 + 캡션 1줄) — ko-only.
 */
describe('i18n ko — chord modal tone-omission keys', () => {
  it('has a caption shown when some voicings omit formula notes', () => {
    expect(ko.tonesOmittedCaption).toBeTruthy();
    expect(typeof ko.tonesOmittedCaption).toBe('string');
  });

  it('has a per-chip tooltip explaining the note is omitted', () => {
    expect(ko.toneOmittedTitle).toBeTruthy();
    expect(typeof ko.toneOmittedTitle).toBe('string');
  });
});
