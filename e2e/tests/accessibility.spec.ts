import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import {
  field,
  heading,
  signInThroughApi,
  signInThroughForm,
  signUpThroughForm,
  WELCOME,
} from './support/app.js';
import { expect, GUEST_REFRESH, test } from './support/fixtures.js';

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
 * At 320px wide the page must not scroll sideways (WCAG 1.4.10, Reflow: the
 * width of a 1280px screen zoomed to 400%). It tries to scroll rather than
 * compare widths, which the reserved scrollbar gutter skews by its own width.
 */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  await page.setViewportSize({ width: 320, height: 640 });
  const scrolled = await page.evaluate(() => {
    window.scrollTo(10_000, 0);
    return window.scrollX;
  });
  expect(scrolled, 'pixels the page scrolled sideways at 320px').toBe(0);
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

test.describe('answers from the server', () => {
  test.use({
    expectedApiErrors: [GUEST_REFRESH, '401 /api/v1/auth/sign-in', '409 /api/v1/auth/sign-up'],
  });

  test('sign-in page with a wrong password', async ({ page, account }) => {
    await page.goto('/sign-in');
    await signInThroughForm(page, { ...account, password: 'Wrong-password-1' });
    await expect(page.getByRole('alert')).toContainText('The email or password is incorrect.');

    await expectNoViolations(page);
  });

  test('sign-up page with an email that is already registered', async ({ page, account }) => {
    await page.goto('/sign-up');
    await signUpThroughForm(page, account);
    await expect(field(page, 'Email')).toHaveAccessibleDescription(
      'An account with this email already exists.',
    );

    await expectNoViolations(page);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  /** The size of what a finger can hit; `expect.soft` so one run reports every small target. */
  async function expectTouchTarget(target: Locator, name: string): Promise<void> {
    const box = await target.boundingBox();
    expect.soft(box?.width, `width of ${name}`).toBeGreaterThanOrEqual(44);
    expect.soft(box?.height, `height of ${name}`).toBeGreaterThanOrEqual(44);
  }

  // The "Create one" link sits inside a sentence, which WCAG's target-size rules exempt.
  test('the masthead links, the theme button and the form buttons are at least 44px square to the touch', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await expect(heading(page)).toHaveText('Sign in.');

    await expectTouchTarget(page.getByRole('link', { name: 'Auth Module' }), 'the wordmark');
    await expectTouchTarget(page.getByRole('button', { name: 'Theme: Auto' }), 'the theme button');
    for (const name of ['Sign in', 'Create account']) {
      await expectTouchTarget(
        page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }),
        `the "${name}" index link`,
      );
    }
    await expectTouchTarget(page.getByRole('button', { name: 'Show password' }), 'Show');
    await expectTouchTarget(page.getByRole('button', { name: 'Sign in' }), 'Sign in');
  });
});
