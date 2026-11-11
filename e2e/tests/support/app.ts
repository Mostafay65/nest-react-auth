import { expect, type Locator, type Page } from '@playwright/test';
import type { Account } from './fixtures.js';

export const WELCOME = 'Welcome to the application.';

/** A form field by its label. `exact` stops "Password" from also matching "Show password". */
export const field = (page: Page, label: 'Name' | 'Email' | 'Password'): Locator =>
  page.getByLabel(label, { exact: true });

export const heading = (page: Page): Locator => page.getByRole('heading', { level: 1 });

/** A value in the welcome page's account ledger, such as the email. */
export const ledgerValue = (page: Page, term: string): Locator =>
  page.locator(`dt:text-is("${term}") + dd`);

export async function signUpThroughForm(page: Page, account: Account): Promise<void> {
  await field(page, 'Name').fill(account.name);
  await field(page, 'Email').fill(account.email);
  await field(page, 'Password').fill(account.password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

export async function signInThroughForm(page: Page, account: Account): Promise<void> {
  await field(page, 'Email').fill(account.email);
  await field(page, 'Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/**
 * Signs in through the API instead of the form. The refresh cookie lands in
 * the page's browser context, so the next page load starts signed in.
 */
export async function signInThroughApi(page: Page, { email, password }: Account): Promise<void> {
  const response = await page.request.post('/api/v1/auth/sign-in', { data: { email, password } });
  expect(response.status(), 'sign-in through the API').toBe(200);
}

/** Counts the requests the page sends to one endpoint from now on. */
export function countRequests(page: Page, method: string, path: string): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.method() === method && new URL(request.url()).pathname === path) count += 1;
  });
  return () => count;
}
