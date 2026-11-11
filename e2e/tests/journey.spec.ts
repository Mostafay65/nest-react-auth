import {
  countRequests,
  heading,
  ledgerValue,
  signInThroughForm,
  signUpThroughForm,
  WELCOME,
} from './support/app.js';
import { expect, newAccount, test } from './support/fixtures.js';

test('a new user signs up, stays signed in across a reload, signs out and signs back in', async ({
  page,
}) => {
  const user = newAccount('journey');

  await page.goto('/sign-up');
  await expect(page).toHaveTitle('Create account · Auth Module');
  await signUpThroughForm(page, user);

  await expect(page).toHaveURL('/app');
  await expect(heading(page)).toHaveText(WELCOME);
  await expect(page).toHaveTitle('Welcome · Auth Module');
  await expect(ledgerValue(page, 'Name')).toHaveText(user.name);
  await expect(ledgerValue(page, 'Email')).toHaveText(user.email);

  // The access token lives in memory, so a reload restores the session from
  // the refresh cookie: one refresh call, then the profile.
  const refreshes = countRequests(page, 'POST', '/api/v1/auth/refresh');
  await page.reload();
  await expect(heading(page)).toHaveText(WELCOME);
  await expect(page).toHaveURL('/app');
  expect(refreshes(), 'refresh calls after the reload').toBe(1);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');

  await page.goto('/app');
  await expect(page).toHaveURL('/sign-in');

  await signInThroughForm(page, user);
  await expect(page).toHaveURL('/app');
  await expect(ledgerValue(page, 'Email')).toHaveText(user.email);
});
