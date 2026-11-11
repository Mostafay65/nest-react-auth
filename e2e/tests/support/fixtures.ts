import { randomUUID } from 'node:crypto';
import { test as base, type ConsoleMessage, expect, type Page } from '@playwright/test';

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** Every page load starts with a refresh call, and for a guest the API answers 401. */
export const GUEST_REFRESH = '401 /api/v1/auth/refresh';

/** A new account with an email no earlier run has used. */
export function newAccount(label: string): Account {
  return {
    name: 'Ada Lovelace',
    email: `${label}-${randomUUID().slice(0, 8)}@example.com`,
    password: 'Analytical1!',
  };
}

interface TestFixtures {
  /**
   * API calls the test expects to fail, as `<status> <path>`. Chrome logs each
   * failed call as a console error; any other console error fails the test.
   * (Strings, because Playwright reads an array whose second item is an object
   * as a [value, options] fixture tuple.)
   */
  expectedApiErrors: readonly string[];
  /** Opens another tab in the same browser, sharing cookies, watched for errors like `page`. */
  openTab: () => Promise<Page>;
}

interface WorkerFixtures {
  /** A registered account, made once per worker, for tests that need an existing user. */
  account: Account;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  expectedApiErrors: [[GUEST_REFRESH], { option: true }],

  page: async ({ page, expectedApiErrors }, use) => {
    const problems = await watchForErrors(page, expectedApiErrors);
    await use(page);
    expect(problems, 'errors the page reported').toEqual([]);
  },

  openTab: async ({ context, expectedApiErrors }, use) => {
    const reports: string[][] = [];
    await use(async () => {
      const tab = await context.newPage();
      reports.push(await watchForErrors(tab, expectedApiErrors));
      return tab;
    });
    expect(reports.flat(), 'errors the other tabs reported').toEqual([]);
  },

  account: [
    async ({ playwright }, use, workerInfo) => {
      const api = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL });
      const account = newAccount('existing');
      const response = await api.post('/api/v1/auth/sign-up', { data: account });
      expect(response.status(), 'sign-up of the shared account').toBe(201);
      await api.dispose();
      await use(account);
    },
    { scope: 'worker' },
  ],
});

export { expect };

/**
 * Collects what a page reports: uncaught exceptions, CSP violations, and
 * console errors other than the expected failed API calls.
 */
async function watchForErrors(page: Page, expectedApiErrors: readonly string[]): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`uncaught ${error.name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (isExpectedApiError(message, expectedApiErrors)) return;
    problems.push(`console.error: ${message.text()}`);
  });
  // Playwright injects this script outside the page's CSP, so it can report on it.
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const source = `${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`;
      console.error(
        `CSP violation: ${event.violatedDirective} blocked ${event.blockedURI} at ${source}`,
      );
    });
  });
  return problems;
}

const FAILED_CALL = /^Failed to load resource: the server responded with a status of (\d{3})\b/;

function isExpectedApiError(message: ConsoleMessage, expected: readonly string[]): boolean {
  const status = FAILED_CALL.exec(message.text())?.[1];
  if (status === undefined) return false;
  return expected.includes(`${status} ${new URL(message.location().url).pathname}`);
}
