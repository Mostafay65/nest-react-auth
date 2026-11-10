import { defineConfig } from 'vitest/config';

/** End-to-end tests: the real app, booted by createApp(), against an in-memory MongoDB. */
export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/mongo-memory-server.ts'],
    setupFiles: ['./test/setup/e2e-env.ts'],
    // The first run downloads a MongoDB binary, and every file boots the whole app.
    hookTimeout: 120_000,
  },
});
