import { heading } from './support/app.js';
import { expect, test } from './support/fixtures.js';

const GUEST_PAGES = ['/sign-in', '/sign-up', '/no-such-page'];

// The CSP checks in the other tests only mean something if the policy is in force.
test('pages are served with the strict content security policy', async ({ page }) => {
  for (const path of GUEST_PAGES) {
    const response = await page.goto(path);
    const policy = response?.headers()['content-security-policy'] ?? '';

    expect(policy, `CSP of ${path}`).toContain("script-src 'self'");
    expect(policy, `CSP of ${path}`).toContain("style-src 'self'");
    expect(policy, `CSP of ${path}`).not.toContain('unsafe');
  }
});

// Zod checks for eval when a schema is built unless it runs jitless (apps/web/src/app/zod-config.ts).
test('no page load trips the content security policy, a caught eval included', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('CSP violation:')) violations.push(message.text());
  });

  for (const path of GUEST_PAGES) {
    await page.goto(path);
    await expect(heading(page)).toBeVisible();
  }

  expect(violations).toEqual([]);
});
