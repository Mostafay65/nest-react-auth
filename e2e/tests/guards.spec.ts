import { heading, signInThroughApi, WELCOME } from './support/app.js';
import { expect, test } from './support/fixtures.js';

test.describe('a guest', () => {
  test('is sent from the app page to sign in', async ({ page }) => {
    await page.goto('/app');

    await expect(page).toHaveURL('/sign-in');
    await expect(heading(page)).toHaveText('Sign in.');
  });

  test('is sent from the start page to sign in', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/sign-in');
  });
});

test('a signed-in user is sent from the start, sign-in and sign-up pages to the app', async ({
  page,
  account,
}) => {
  await signInThroughApi(page, account);

  for (const path of ['/', '/sign-in', '/sign-up']) {
    await page.goto(path);
    await expect(page, `after opening ${path}`).toHaveURL('/app');
    await expect(heading(page)).toHaveText(WELCOME);
  }
});

test('an unknown address shows the not-found page', async ({ page }) => {
  await page.goto('/no-such-page');

  await expect(heading(page)).toHaveText('Not in the index.');
  await expect(page).toHaveTitle('Page not found · Auth Module');
  await page.getByRole('link', { name: 'Go to the start' }).click();
  await expect(page).toHaveURL('/sign-in');
});
