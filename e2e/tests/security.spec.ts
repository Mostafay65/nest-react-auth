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

// Without Sec-Fetch-Site (an API client, an older browser), the API compares Origin
// with Host, so nginx has to pass the Host on with its port.
test('a write that carries only an Origin is checked against the right host', async ({
  request,
  baseURL,
}) => {
  const ownOrigin = new URL(baseURL ?? '').origin;

  const fromThisSite = await request.post('/api/v1/auth/sign-out', {
    headers: { Origin: ownOrigin },
  });
  const fromAnotherSite = await request.post('/api/v1/auth/sign-out', {
    headers: { Origin: 'https://evil.example' },
  });

  expect(fromThisSite.status()).toBe(204);
  expect(fromAnotherSite.status()).toBe(403);
});

test('assets are cached for good, but a missing one is not cached at all', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const script = /\/assets\/[\w.-]+\.js/.exec(html)?.[0];
  expect(script, 'a script in index.html').toBeDefined();

  const asset = await request.get(script ?? '', { headers: { 'Accept-Encoding': 'gzip' } });
  const missing = await request.get('/assets/no-such-file.js');

  expect(asset.headers()).toMatchObject({
    'cache-control': 'public, max-age=31536000, immutable',
    'content-encoding': 'gzip',
    // So a shared cache never hands the compressed copy to a client that can't read it.
    vary: 'Accept-Encoding',
  });
  expect(missing.status()).toBe(404);
  expect(missing.headers()['cache-control']).toBeUndefined();
});
