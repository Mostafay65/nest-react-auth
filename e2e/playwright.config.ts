import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a stack that is already up (`npm run stack:up`), through nginx,
 * exactly as a user reaches it. Point BASE_URL elsewhere to test another copy.
 */
export default defineConfig({
  testDir: './tests',
  // The API allows 10 sign-ups and 10 sign-ins per minute per client IP, and
  // nginx sets that IP, so tests can't spread their calls across addresses. One
  // worker and no retries keep a run at 4 sign-ups and 7 sign-ins.
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /screenshots\.spec\.ts/,
    },
    {
      // Writes the README screenshots to docs/screenshots. Only `npm run screenshots` selects it.
      name: 'screenshots',
      use: {
        ...devices['Desktop Chrome'],
        // Overlay scrollbars, as on macOS and phones: the page's reserved scrollbar
        // gutter would otherwise show as a blank strip down the right edge.
        launchOptions: { args: ['--enable-features=OverlayScrollbar'] },
      },
      testMatch: /screenshots\.spec\.ts/,
    },
  ],
});
