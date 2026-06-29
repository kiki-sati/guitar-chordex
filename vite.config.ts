/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
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
