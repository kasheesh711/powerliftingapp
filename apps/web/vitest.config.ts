import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@powerlifting/data': fileURLToPath(new URL('../../packages/data/src/index.ts', import.meta.url)),
      '@powerlifting/domain': fileURLToPath(
        new URL('../../packages/domain/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts']
  }
});
