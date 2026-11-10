import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { sessionStore } from '@/features/auth/session-store';
import { ada, endpoints, expiredToken, respond, server, sessionFor } from '@/test/api';
import { renderApp } from '@/test/render-app';

async function openWelcome() {
  const rendered = renderApp('/app');
  await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });
  return rendered;
}

describe('Welcome page', () => {
  it('shows the profile from GET /users/me', async () => {
    server.use(respond.refreshSignedIn(), respond.profile());

    await openWelcome();

    const ledger = screen.getByRole('region', { name: 'Your account' });
    expect(ledger).toHaveTextContent('Ada Lovelace');
    expect(ledger).toHaveTextContent('ada@example.com');
    expect(ledger).toHaveTextContent('14 March 2026');
  });

  it('signs out on the server, then returns to the sign-in page', async () => {
    let signedOutOnServer = false;
    server.use(
      respond.refreshSignedIn(),
      respond.profile(),
      http.post(endpoints.signOut, () => {
        signedOutOnServer = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, router } = await openWelcome();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in.' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(signedOutOnServer).toBe(true);
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
  });

  it('stays signed in, and says so, when signing out fails', async () => {
    server.use(
      respond.refreshSignedIn(),
      respond.profile(),
      http.post(endpoints.signOut, () => HttpResponse.error()),
    );
    const { user, router } = await openWelcome();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('you are still signed in');
    expect(router.state.location.pathname).toBe('/app');
  });

  it('goes back to sign-in when the session ends while the page loads', async () => {
    server.use(
      // The boot refresh succeeds, but the session is revoked before the profile loads.
      http.post(endpoints.refresh, () => HttpResponse.json(sessionFor('access-1')), { once: true }),
      respond.refreshSignedOut(),
      http.get(endpoints.me, () => expiredToken()),
    );

    const { router } = renderApp('/app');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in.' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it("shows the server's current profile, not the copy kept from sign-in", async () => {
    server.use(
      respond.refreshSignedIn('token-1'),
      respond.profile({ ...ada, name: 'Grace Hopper' }),
    );

    await openWelcome();

    expect(screen.getByRole('region', { name: 'Your account' })).toHaveTextContent('Grace Hopper');
  });
});
