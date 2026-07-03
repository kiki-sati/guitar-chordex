import { describe, it, expect } from 'vitest';
import { ko } from '../strings';

/**
 * PR⑤ 마이그레이션 모달 i18n 키 (ko-only).
 * MigrationModal 테스트가 이 라벨들로 쿼리하므로 키를 고정한다.
 */
describe('i18n ko — migration keys (PR⑤)', () => {
  it('has migration modal copy keys', () => {
    expect(ko.migrateTitle).toBeTruthy();
    expect(ko.migrateBody).toBeTruthy();
    expect(ko.migrateImport).toBeTruthy();
    expect(ko.migrateSkip).toBeTruthy();
    expect(ko.migrateImporting).toBeTruthy();
  });
});
