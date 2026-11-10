import { delay, http, HttpResponse } from 'msw';
import { fetchProfile } from '@/features/profile/profile-api';
import { ada, endpoints, expiredToken, problem, respond, server, sessionFor } from '@/test/api';
import { sessionStore } from './session-store';

/** GET /users/me that only accepts `validToken`, recording every Authorization header it sees. */
function profileAcceptingOnly(validToken: string) {
  const seen: Array<string | null> = [];
  const handler = http.get(endpoints.me, ({ request }) => {
    const authorization = request.headers.get('Authorization');
    seen.push(authorization);
    return authorization === `Bearer ${validToken}` ? HttpResponse.json(ada) : expiredToken();
  });
  return { handler, seen };
}

/** POST /auth/refresh that issues `nextToken`, counting the calls. */
function refreshIssuing(nextToken: string) {
  const calls = { count: 0 };
  const handler = http.post(endpoints.refresh, async () => {
    calls.count += 1;
    await delay(20);
    return HttpResponse.json(sessionFor(nextToken));
  });
  return { handler, calls };
}

describe('authorized requests', () => {
  it('send the access token as a bearer token', async () => {
    sessionStore.start(sessionFor('token-1'));
    const profile = profileAcceptingOnly('token-1');
    server.use(profile.handler);

    await expect(fetchProfile()).resolves.toEqual(ada);
    expect(profile.seen).toEqual(['Bearer token-1']);
  });

  it('refresh the session once and retry once when the access token has expired', async () => {
    sessionStore.start(sessionFor('expired-token'));
    const profile = profileAcceptingOnly('fresh-token');
    const refresh = refreshIssuing('fresh-token');
    server.use(profile.handler, refresh.handler);

    await expect(fetchProfile()).resolves.toEqual(ada);
    expect(refresh.calls.count).toBe(1);
    expect(profile.seen).toEqual(['Bearer expired-token', 'Bearer fresh-token']);
  });

  it('share one refresh between requests that fail at the same time', async () => {
    sessionStore.start(sessionFor('expired-token'));
    const profile = profileAcceptingOnly('fresh-token');
    const refresh = refreshIssuing('fresh-token');
    server.use(profile.handler, refresh.handler);

    await expect(Promise.all([fetchProfile(), fetchProfile()])).resolves.toEqual([ada, ada]);
    expect(refresh.calls.count).toBe(1);
  });

  it('sign out when the session can no longer be refreshed', async () => {
    sessionStore.start(sessionFor('expired-token'));
    server.use(
      http.get(endpoints.me, () => expiredToken()),
      respond.refreshSignedOut(),
    );

    await expect(fetchProfile()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
  });

  it('do not refresh for failures that are not about the token', async () => {
    sessionStore.start(sessionFor('token-1'));
    const refresh = refreshIssuing('unused');
    server.use(
      http.get(endpoints.me, () => problem(500, 'INTERNAL_ERROR', 'Something went wrong.')),
      refresh.handler,
    );

    await expect(fetchProfile()).rejects.toMatchObject({ status: 500 });
    expect(refresh.calls.count).toBe(0);
  });

  it('reject an answer that does not match the API contract', async () => {
    sessionStore.start(sessionFor('token-1'));
    server.use(http.get(endpoints.me, () => HttpResponse.json({ id: ada.id, name: ada.name })));

    await expect(fetchProfile()).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE' });
  });
});
