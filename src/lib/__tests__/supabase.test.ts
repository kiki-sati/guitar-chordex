import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * supabase.ts 가드 테스트 (B 경계면: env 부재 graceful — AC-11).
 *
 * - createClient는 vi.mock으로 모킹 → 실제 네트워크/SDK 동작 0.
 * - 모듈은 import 시점에 env를 평가하므로, 각 시나리오는
 *   vi.resetModules() + 동적 import로 깨끗한 평가를 강제한다.
 */

type CreateClientArgs = [url: string, anon: string, options: { auth: Record<string, unknown> }];

const createClientMock = vi.fn(
  (..._args: CreateClientArgs) => ({ __mockClient: true }),
);

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

beforeEach(() => {
  vi.resetModules();
  createClientMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supabase.ts — env 미설정 (로컬 전용 모드, AC-11)', () => {
  it('env가 없어도 import 시 크래시하지 않는다', async () => {
    // 두 env 변수를 명시적으로 비워 둠.
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await expect(import('../supabase')).resolves.toBeDefined();
  });

  it('isSupabaseConfigured === false', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const mod = await import('../supabase');
    expect(mod.isSupabaseConfigured).toBe(false);
  });

  it('supabase === null 이고 createClient는 호출되지 않는다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const mod = await import('../supabase');
    expect(mod.supabase).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('url만 있고 anon이 없으면 미설정으로 본다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const mod = await import('../supabase');
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
  });
});

describe('supabase.ts — env 설정', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
  });

  it('isSupabaseConfigured === true', async () => {
    const mod = await import('../supabase');
    expect(mod.isSupabaseConfigured).toBe(true);
  });

  it('supabase !== null (createClient 결과)', async () => {
    const mod = await import('../supabase');
    expect(mod.supabase).not.toBeNull();
  });

  it('createClient가 url/anon + PKCE 인증 옵션으로 호출된다', async () => {
    await import('../supabase');
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, anon, options] = createClientMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co');
    expect(anon).toBe('anon-test-key');
    expect(options.auth.flowType).toBe('pkce');
    expect(options.auth.autoRefreshToken).toBe(true);
    expect(options.auth.persistSession).toBe(true);
    // 웹(테스트 환경 = 비네이티브): URL 세션 감지 on, storage 기본(localStorage) = undefined.
    expect(options.auth.detectSessionInUrl).toBe(true);
    expect(options.auth.storage).toBeUndefined();
  });
});
