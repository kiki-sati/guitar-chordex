/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// base: GitHub Pages(프로젝트 페이지)는 서브경로에 서빙되므로 BASE_PATH로 주입.
// 기본값 '/' → 로컬 dev·Capacitor 빌드 무영향. Pages 배포 워크플로만 '/guitar-chordex/' 설정.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: false,
    // 병렬 세션 워크트리(.claude/worktrees/*)의 테스트가 중복 수집되지 않도록 제외.
    // vitest 기본 exclude를 보존한 채 .claude만 추가한다.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
