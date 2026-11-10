import '@testing-library/jest-dom/vitest';
import { sessionStore } from '@/features/auth/session-store';
import { server } from './api';
import { installWebLocks } from './web-locks';

installWebLocks();

// jsdom does no layout, so it has no scrolling; ScrollRestoration calls this on every navigation.
window.scrollTo = () => {};

// React and React Router report mistakes as console warnings, which are easy to miss in the
// output of passing tests. Any console warning or error therefore fails the test that caused it.
let consoleProblems: string[] = [];
beforeEach(() => {
  consoleProblems = [];
  for (const level of ['warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      consoleProblems.push(`console.${level}: ${args.map(String).join(' ')}`);
    });
  }
});

// A request to an endpoint the test did not declare fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  sessionStore.reset();
  vi.restoreAllMocks();
  expect(consoleProblems).toEqual([]);
});
afterAll(() => server.close());
