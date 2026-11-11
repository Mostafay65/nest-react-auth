import { delay, http, HttpResponse } from 'msw';
import { ada, endpoints, problem, respond, server, sessionFor } from '@/test/api';
import { otherTab } from '@/test/other-tab';
import { ensureSession, followOtherTab, refreshSession, signOut, startSession } from './session';
import { sessionStore } from './session-store';

/** A second tab: the session module loaded again, with its own memory, sharing only the Web Lock. */
async function openTab() {
  vi.resetModules();
  const [session, store] = await Promise.all([import('./session'), import('./session-store')]);
  return { refreshSession: session.refreshSession, store: store.sessionStore };
}

describe('refreshSession', () => {
  it('starts the session with the new access token', async () => {
    server.use(respond.refreshSignedIn('fresh-token'));

    await expect(refreshSession()).resolves.toBe(true);
    expect(sessionStore.get()).toEqual({
      status: 'signed-in',
      user: ada,
      accessToken: 'fresh-token',
    });
  });

  it('waits as long as nginx does, since a refresh abandoned sooner may still rotate the token', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    server.use(respond.refreshSignedIn());

    await refreshSession();

    expect(timeout).toHaveBeenCalledWith(60_000);
  });

  it('ends the session, in every tab, when the refresh cookie is no longer accepted', async () => {
    const tab = otherTab();
    sessionStore.start(sessionFor('old-token'));
    server.use(respond.refreshSignedOut());

    await expect(refreshSession()).resolves.toBe(false);
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
    await vi.waitFor(() => expect(tab.heard).toEqual(['signed-out']));
  });

  it('keeps quiet when a tab that is only starting up finds no session', async () => {
    // Another tab may be signing in at this very moment; telling it to sign out would be wrong.
    const tab = otherTab();
    server.use(respond.refreshSignedOut());

    await expect(refreshSession()).resolves.toBe(false);
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
    // A message would arrive within a tick; give it a few before concluding there is none.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tab.heard).toEqual([]);
  });

  it('keeps the session and reports the failure when the server cannot be reached', async () => {
    sessionStore.start(sessionFor('old-token'));
    server.use(http.post(endpoints.refresh, () => HttpResponse.error()));

    await expect(refreshSession()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(sessionStore.accessToken()).toBe('old-token');
  });

  it('sends one request however many callers ask at once', async () => {
    let requests = 0;
    server.use(
      http.post(endpoints.refresh, async () => {
        requests += 1;
        await delay(20);
        return HttpResponse.json(sessionFor('fresh-token'));
      }),
    );

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(results).toEqual([true, true, true]);
    expect(requests).toBe(1);
  });

  it('lets one tab refresh at a time, so two tabs never send the same refresh token', async () => {
    let inFlight = 0;
    let mostAtOnce = 0;
    let issued = 0;
    server.use(
      http.post(endpoints.refresh, async () => {
        inFlight += 1;
        mostAtOnce = Math.max(mostAtOnce, inFlight);
        await delay(20);
        inFlight -= 1;
        issued += 1;
        return HttpResponse.json(sessionFor(`token-${issued}`));
      }),
    );
    const [first, second] = [await openTab(), await openTab()];

    await expect(Promise.all([first.refreshSession(), second.refreshSession()])).resolves.toEqual([
      true,
      true,
    ]);

    expect(mostAtOnce).toBe(1);
    expect([first.store.accessToken(), second.store.accessToken()]).toEqual(['token-1', 'token-2']);
  });
});

describe('ensureSession', () => {
  it('asks the server once, then answers from memory', async () => {
    let requests = 0;
    server.use(
      http.post(endpoints.refresh, () => {
        requests += 1;
        return HttpResponse.json(sessionFor('access-1'));
      }),
    );

    await ensureSession();
    await ensureSession();

    expect(requests).toBe(1);
    expect(sessionStore.get().status).toBe('signed-in');
  });

  it.each([
    ['cannot be reached', () => HttpResponse.error()],
    ['fails', () => problem(503, 'SERVICE_UNAVAILABLE', 'The service is unavailable.')],
    ['is rate limiting', () => problem(429, 'RATE_LIMITED', 'Too many requests.')],
  ])('does not take the user for signed out when the server %s', async (_case, answer) => {
    server.use(http.post(endpoints.refresh, answer, { once: true }), respond.refreshSignedIn());

    await expect(ensureSession()).rejects.toBeInstanceOf(Error);
    expect(sessionStore.get()).toEqual({ status: 'unknown' });

    // Still unknown, so the next navigation asks again.
    await expect(ensureSession()).resolves.toMatchObject({ status: 'signed-in' });
  });
});

describe('startSession', () => {
  it('starts the session from a sign-in or sign-up and tells the other tabs', async () => {
    const tab = otherTab();

    startSession(sessionFor('access-1'));

    expect(sessionStore.accessToken()).toBe('access-1');
    await vi.waitFor(() => expect(tab.heard).toEqual(['signed-in']));
  });
});

describe('signOut', () => {
  it('ends the session on the server, then in memory and in the other tabs', async () => {
    const tab = otherTab();
    sessionStore.start(sessionFor('access-1'));
    let calledServer = false;
    server.use(
      http.post(endpoints.signOut, () => {
        calledServer = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await signOut();

    expect(calledServer).toBe(true);
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
    await vi.waitFor(() => expect(tab.heard).toEqual(['signed-out']));
  });

  it('keeps the session if the server cannot be reached, so a reload cannot undo the sign-out', async () => {
    sessionStore.start(sessionFor('access-1'));
    server.use(http.post(endpoints.signOut, () => HttpResponse.error()));

    await expect(signOut()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(sessionStore.get().status).toBe('signed-in');
  });

  it('announces nothing when a refresh merely renews the session', async () => {
    const tab = otherTab();
    server.use(respond.refreshSignedIn(), respond.signOut());

    await refreshSession();
    await signOut();

    // Messages arrive in order, so had the refresh announced anything, it would come first.
    await vi.waitFor(() => expect(tab.heard).toEqual(['signed-out']));
  });
});

describe('followOtherTab', () => {
  it.each([
    ['signed-out', 'signed in', () => sessionStore.start(sessionFor('access-1')), 'signed-out'],
    ['signed-in', 'signed out', () => sessionStore.end(), 'unknown'],
    ['signed-in', 'not yet known', () => sessionStore.reset(), 'unknown'],
  ] as const)(
    'follows "%s" in a tab that is %s, so the guards run again',
    (event, _state, arrange, expected) => {
      arrange();

      expect(followOtherTab(event)).toBe(true);
      expect(sessionStore.get().status).toBe(expected);
    },
  );

  it.each([
    ['signed-out', 'signed out', () => sessionStore.end()],
    ['signed-in', 'signed in', () => sessionStore.start(sessionFor('access-1'))],
  ] as const)('ignores "%s" in a tab that is already %s', (event, _state, arrange) => {
    arrange();
    const before = sessionStore.get();

    expect(followOtherTab(event)).toBe(false);
    expect(sessionStore.get()).toBe(before);
  });

  it('never announces anything itself, so tabs cannot set each other off', () => {
    const post = vi.spyOn(BroadcastChannel.prototype, 'postMessage');
    sessionStore.start(sessionFor('access-1'));

    followOtherTab('signed-out');
    followOtherTab('signed-in');

    expect(post).not.toHaveBeenCalled();
  });
});
