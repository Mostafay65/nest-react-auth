import { delay, http, HttpResponse } from 'msw';
import { ada, endpoints, respond, server, sessionFor } from '@/test/api';
import { ensureSession, refreshSession, signOut } from './session';
import { sessionStore } from './session-store';

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

  it('ends the session when the refresh cookie is no longer accepted', async () => {
    sessionStore.start(sessionFor('old-token'));
    server.use(respond.refreshSignedOut());

    await expect(refreshSession()).resolves.toBe(false);
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
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

  it('refreshes inside a Web Lock, so tabs never send the same refresh token twice', async () => {
    const lock = vi.spyOn(navigator.locks, 'request');
    server.use(respond.refreshSignedIn());

    await refreshSession();

    expect(lock).toHaveBeenCalledWith('auth-refresh', expect.any(Function));
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

  it('treats an unreachable server as signed out', async () => {
    server.use(http.post(endpoints.refresh, () => HttpResponse.error()));

    await expect(ensureSession()).resolves.toEqual({ status: 'signed-out' });
  });
});

describe('signOut', () => {
  it('ends the session on the server, then in memory', async () => {
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
  });

  it('keeps the session if the server cannot be reached, so a reload cannot undo the sign-out', async () => {
    sessionStore.start(sessionFor('access-1'));
    server.use(http.post(endpoints.signOut, () => HttpResponse.error()));

    await expect(signOut()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(sessionStore.get().status).toBe('signed-in');
  });
});
