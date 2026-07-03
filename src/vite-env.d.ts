/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // 네이티브 sign-in 설정(콘솔 발급 — PR⑥). 미설정이어도 웹 빌드·테스트 무영향.
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_APPLE_REDIRECT_URI?: string;
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string;
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
