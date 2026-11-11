import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { heading, signInThroughApi, WELCOME } from './support/app.js';
import { expect, test } from './support/fixtures.js';

/** WCAG 2.0, 2.1 and 2.2 at levels A and AA. */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

// The page fades in when motion is allowed; a scan mid-fade would misjudge colour contrast.
test.use({ reducedMotion: 'reduce' });

/** Scans the page with axe in the light theme, then in the dark one. */
async function expectNoViolations(page: Page): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    expect(violations.map(summarize), `axe violations in the ${colorScheme} theme`).toEqual([]);
  }
}

/**
 * At 390px, a phone's width, the page must not scroll sideways (WCAG 1.4.10,
 * Reflow). It tries to scroll rather than compare widths, which the reserved
 * scrollbar gutter skews by its own width.
 */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  const scrolled = await page.evaluate(() => {
    window.scrollTo(10_000, 0);
    return window.scrollX;
  });
  expect(scrolled, 'pixels the page scrolled sideways at 390px').toBe(0);
}

const summarize = ({ id, impact, help, nodes }: Violation) => ({
  id,
  impact,
  help,
  elements: nodes.map((node) => node.target.join(' ')),
});

test('sign-in page', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(heading(page)).toHaveText('Sign in.');

  await expectNoViolations(page);
  await expectNoSidewaysScroll(page);
});

test('sign-up page, empty and with every field in error', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(heading(page)).toHaveText('Create an account.');
  await expectNoViolations(page);

  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Name is required')).toBeVisible();
  await expectNoViolations(page);
  await expectNoSidewaysScroll(page);
});

test('welcome page', async ({ page, account }) => {
  await signInThroughApi(page, account);
  await page.goto('/app');
  await expect(heading(page)).toHaveText(WELCOME);

  await expectNoViolations(page);
  await expectNoSidewaysScroll(page);
});

test('not-found page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(heading(page)).toHaveText('Not in the index.');

  await expectNoViolations(page);
  await expectNoSidewaysScroll(page);
});
