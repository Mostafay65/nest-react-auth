/// <reference types="@testing-library/jest-dom/vitest" />
import * as domMatchers from '@testing-library/jest-dom/matchers';
import { cleanup, configure } from '@testing-library/react';
import { sessionStore } from '@/features/auth/session-store';
import { server } from './api';
import { checkConsole, watchConsole } from './console';
import { installWebLocks } from './web-locks';

// jest-dom's matchers go on the very `expect` the tests use. The usual
// `import '@testing-library/jest-dom/vitest'` makes jest-dom import Vitest itself,
// and on Windows, when the working directory's drive letter is lower-case, that
// loads a second copy of Vitest, which then gets the matchers instead.
expect.extend(domMatchers);

// `findBy…` and `waitFor` wait up to 3 s instead of 1 s. On a cold run, or a busy CI
// runner, a first render can take longer than a second; a failing test still fails.
configure({ asyncUtilTimeout: 3_000 });

installWebLocks();

// jsdom does no layout, so it has no scrolling; ScrollRestoration calls this on every navigation.
window.scrollTo = () => {};

beforeEach(() => watchConsole());

// A request to an endpoint the test did not declare fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  // Unmount first, so the app can't react to the resets below. Testing Library
  // unmounts after each test too, but its hook was registered before this one,
  // and Vitest runs these hooks in reverse order, skipping the rest when one fails.
  cleanup();
  server.resetHandlers();
  sessionStore.reset();
  vi.restoreAllMocks();
  checkConsole();
});
afterAll(() => server.close());
