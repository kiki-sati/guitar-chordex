import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// env는 미설정일 수 있다(개발 편의 / 로컬 전용 모드 — AC-11).
// 빈 문자열도 미설정으로 취급한다(Boolean(url && anon)).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// 모바일(네이티브): @capacitor/preferences 어댑터.
// 웹뷰 localStorage는 OS가 비울 수 있어 세션 영속이 불안정하므로 Preferences를 쓴다.
const nativeStorage = {
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: async (k: string, v: string) => {
    await Preferences.set({ key: k, value: v });
  },
  removeItem: async (k: string) => {
    await Preferences.remove({ key: k });
  },
};

/**
 * env(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)가 모두 설정됐는지 여부.
 * false면 앱은 로컬 전용 모드로 동작하고, 빌드/테스트는 실패하지 않는다(AC-11).
 */
export const isSupabaseConfigured = Boolean(url && anon);

/**
 * Supabase 클라이언트. env 미설정 시 null (로컬 전용 모드 가드).
 * - flowType: 'pkce' — code↔verifier 교환(딥링크 하이재킹 방어, §10 S3).
 * - storage: 네이티브=Preferences 어댑터, 웹=기본 localStorage(undefined).
 * - detectSessionInUrl: 웹만 URL 자동 감지(네이티브는 딥링크 콜백으로 처리).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anon!, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: !Capacitor.isNativePlatform(),
        storage: Capacitor.isNativePlatform()
          ? (nativeStorage as never)
          : undefined,
      },
    })
  : null;
