import { defineConfig } from 'vitest/config';

/** Unit tests: one class at a time, with in-memory fakes instead of MongoDB. */
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup/silence-nest-logs.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
});
