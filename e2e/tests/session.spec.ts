import { heading, signInThroughApi, signInThroughForm, WELCOME } from './support/app.js';
import { expect, test } from './support/fixtures.js';

test('tabs follow each other: a sign-in in one opens the app in both, a sign-out closes both', async ({
  page,
  openTab,
  account,
}) => {
  await page.goto('/sign-in');
  const otherTab = await openTab();
  await otherTab.goto('/sign-in');
  await expect(heading(otherTab)).toHaveText('Sign in.');

  await signInThroughForm(page, account);
  await expect(page).toHaveURL('/app');
  // The other tab picks up the session from the cookie the sign-in set.
  await expect(otherTab).toHaveURL('/app');
  await expect(heading(otherTab)).toHaveText(WELCOME);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  await expect(otherTab).toHaveURL('/sign-in');
  await expect(heading(otherTab)).toHaveText('Sign in.');
});

test.describe('when signing out fails', () => {
  test.use({ expectedApiErrors: ['503 /api/v1/auth/sign-out'] });

  test('the user stays signed in, with focus still on Sign out to try again', async ({
    page,
    account,
  }) => {
    await page.route('**/api/v1/auth/sign-out', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          detail: 'The service is unavailable.',
          instance: '/api/v1/auth/sign-out',
          code: 'SERVICE_UNAVAILABLE',
        }),
      }),
    );
    await signInThroughApi(page, account);
    await page.goto('/app');
    await expect(heading(page)).toHaveText(WELCOME);

    const signOut = page.getByRole('button', { name: 'Sign out' });
    await signOut.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('alert')).toContainText('you are still signed in');
    await expect(signOut).toBeFocused();
    await expect(page).toHaveURL('/app');
  });
});
