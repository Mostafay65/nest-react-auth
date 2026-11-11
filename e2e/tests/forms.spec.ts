import type { Page } from '@playwright/test';
import { field, signInThroughForm, signUpThroughForm } from './support/app.js';
import { expect, GUEST_REFRESH, test } from './support/fixtures.js';

const PASSWORD_RULES = [
  'At least 8 characters',
  'One letter',
  'One number',
  'One special character',
] as const;

/** Each checklist item ends in a hidden ", done" or ", not yet" for screen readers. */
async function expectRulesMet(page: Page, met: readonly string[]): Promise<void> {
  for (const rule of PASSWORD_RULES) {
    await expect(page.getByRole('listitem').filter({ hasText: rule })).toContainText(
      met.includes(rule) ? ', done' : ', not yet',
    );
  }
}

test.describe('sign-up form', () => {
  test('an empty submit marks every field and focuses the first one', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(field(page, 'Name')).toHaveAccessibleDescription('Name is required');
    await expect(field(page, 'Email')).toHaveAccessibleDescription('Email is required');
    // The password's description also includes the checklist below it.
    await expect(field(page, 'Password')).toHaveAccessibleDescription(/^Password is required/);
    for (const label of ['Name', 'Email', 'Password'] as const) {
      await expect(field(page, label)).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(field(page, 'Name')).toBeFocused();
  });

  test('the password checklist ticks each rule off as it is met', async ({ page }) => {
    await page.goto('/sign-up');
    const password = field(page, 'Password');
    await expectRulesMet(page, []);

    await password.fill('a');
    await expectRulesMet(page, ['One letter']);

    await password.fill('a1');
    await expectRulesMet(page, ['One letter', 'One number']);

    await password.fill('a1!');
    await expectRulesMet(page, ['One letter', 'One number', 'One special character']);

    await password.fill('a1!bcdef');
    await expectRulesMet(page, PASSWORD_RULES);
    await expect(page.getByText('4 of 4 password rules met')).toBeAttached();
  });

  test.describe('with an email that is already registered', () => {
    test.use({ expectedApiErrors: [GUEST_REFRESH, '409 /api/v1/auth/sign-up'] });

    test('shows the server message on the email field and focuses it', async ({
      page,
      account,
    }) => {
      await page.goto('/sign-up');
      // In capitals: an email names one account whatever its letter case.
      await signUpThroughForm(page, { ...account, email: account.email.toUpperCase() });

      await expect(field(page, 'Email')).toHaveAccessibleDescription(
        'An account with this email already exists.',
      );
      await expect(field(page, 'Email')).toBeFocused();
      await expect(page).toHaveURL('/sign-up');
    });
  });
});

test.describe('sign-in form', () => {
  test.use({ expectedApiErrors: [GUEST_REFRESH, '401 /api/v1/auth/sign-in'] });

  test('a wrong password shows one alert and focuses it', async ({ page, account }) => {
    await page.goto('/sign-in');
    await signInThroughForm(page, { ...account, password: 'Wrong-password-1' });

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('You are not signed in');
    await expect(alert).toContainText('The email or password is incorrect.');
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL('/sign-in');
  });
});
