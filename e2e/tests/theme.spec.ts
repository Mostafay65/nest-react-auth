import type { Page } from '@playwright/test';
import { heading } from './support/app.js';
import { expect, test } from './support/fixtures.js';

/** The page background: paper in the light theme, ink in the dark one. */
const LIGHT_PAPER = 'rgb(243, 239, 230)';
const DARK_PAPER = 'rgb(22, 19, 15)';

const paper = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('on a device set to light', () => {
  test.use({ colorScheme: 'light' });

  test('Dark, once picked, beats the device and is back after a reload before any app code runs', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await expect(heading(page)).toHaveText('Sign in.');
    expect(await paper(page)).toBe(LIGHT_PAPER);

    await page.getByRole('button', { name: 'Theme: Auto' }).click();
    await page.getByRole('button', { name: 'Theme: Light' }).click();

    await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();
    expect(await paper(page)).toBe(DARK_PAPER);

    // Swap the app's code for an empty file: the theme must come from the
    // start-up script alone, which runs before the first paint.
    await page.route('**/assets/*.js', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await paper(page)).toBe(DARK_PAPER);
  });
});

test.describe('on a device set to dark', () => {
  test.use({ colorScheme: 'dark' });

  test('Auto follows the device, and Light beats it', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(heading(page)).toHaveText('Sign in.');
    expect(await paper(page)).toBe(DARK_PAPER);

    await page.getByRole('button', { name: 'Theme: Auto' }).click();

    await expect(page.getByRole('button', { name: 'Theme: Light' })).toBeVisible();
    expect(await paper(page)).toBe(LIGHT_PAPER);
  });
});
