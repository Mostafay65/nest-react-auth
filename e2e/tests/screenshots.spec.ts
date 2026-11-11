import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { field, heading, WELCOME } from './support/app.js';
import { expect, test } from './support/fixtures.js';

// Not part of `test:browser`. `npm run screenshots` refreshes the README images.
const OUTPUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots');

test.use({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'light',
  reducedMotion: 'reduce',
});

/** Waits for the bundled fonts, so no image catches a fallback typeface. */
async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({ path: join(OUTPUT, name), fullPage: true });
}

test('README screenshots', async ({ page, browser, baseURL }) => {
  const ada = {
    name: 'Ada Lovelace',
    email: `ada+${Date.now().toString(36)}@example.com`,
    password: 'Analytical1!',
  };

  await page.goto('/sign-up');
  await field(page, 'Name').fill(ada.name);
  await field(page, 'Email').fill(ada.email);
  // Part of the way there, so the checklist shows rules both met and still open.
  await field(page, 'Password').fill('Analytical');
  await capture(page, 'sign-up.png');

  await field(page, 'Password').fill(ada.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(heading(page)).toHaveText(WELCOME);
  await capture(page, 'welcome.png');

  await page.emulateMedia({ colorScheme: 'dark' });
  await capture(page, 'welcome-dark.png');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');

  // A phone, at twice the pixel density so the image stays sharp on high-density screens.
  const phone = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const phonePage = await phone.newPage();
  await phonePage.goto('/sign-in');
  await expect(heading(phonePage)).toHaveText('Sign in.');
  await capture(phonePage, 'sign-in-mobile.png');
  await phone.close();
});
