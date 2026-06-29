import { describe, it, expect } from 'vitest';
import { ko } from '../strings';

/**
 * PR④ 로그인 게이트 i18n 키 (ko-only).
 * LoginScreen / Sidebar 로그아웃 테스트가 이 라벨들로 쿼리하므로
 * 키를 먼저 고정한다(테스트 우선).
 */
describe('i18n ko — auth/login keys (PR④)', () => {
  it('has login screen copy keys', () => {
    expect(ko.loginTitle).toBeTruthy();
    expect(ko.loginSubtitle).toBeTruthy();
    expect(ko.loginGoogle).toBeTruthy();
    expect(ko.loginApple).toBeTruthy();
    expect(ko.loginEmailDivider).toBeTruthy();
    expect(ko.loginEmailLabel).toBeTruthy();
    expect(ko.loginEmailPlaceholder).toBeTruthy();
    expect(ko.loginEmailSubmit).toBeTruthy();
    expect(ko.loginEmailSending).toBeTruthy();
  });

  it('has email validation / status messages', () => {
    expect(ko.loginEmailInvalid).toBeTruthy();
    expect(ko.loginEmailSent).toBeTruthy();
    expect(ko.loginEmailError).toBeTruthy();
  });

  it('has loading splash + logout labels', () => {
    expect(ko.loginLoading).toBeTruthy();
    expect(ko.logout).toBeTruthy();
  });
});
