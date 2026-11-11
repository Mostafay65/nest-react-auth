import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { DataRouter } from 'react-router';
import { sessionStore } from '@/features/auth/session-store';
import { endpoints, expiredToken, problem, respond, server } from '@/test/api';
import { expectConsoleError } from '@/test/console';
import { otherTab } from '@/test/other-tab';
import { renderApp } from '@/test/render-app';

const WELCOME = 'Welcome to the application.';

/** Presses Back and waits for the navigation, guards and all, to finish. */
async function goBack(router: DataRouter) {
  await act(() => router.navigate(-1));
  await waitFor(() => expect(router.state.navigation.state).toBe('idle'));
}

describe('routes', () => {
  it('send a guest who opens the application to sign in', async () => {
    server.use(respond.refreshSignedOut());

    const { router } = renderApp('/app');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in.' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
  });

  it('send a signed-in user who opens sign-in to the application', async () => {
    server.use(respond.refreshSignedIn(), respond.profile());

    const { router } = renderApp('/sign-in');

    expect(await screen.findByRole('heading', { level: 1, name: WELCOME })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('send a signed-in user away from sign-up too', async () => {
    server.use(respond.refreshSignedIn(), respond.profile());

    const { router } = renderApp('/sign-up');

    await screen.findByRole('heading', { level: 1, name: WELCOME });
    expect(router.state.location.pathname).toBe('/app');
  });

  it.each([
    ['a guest', respond.refreshSignedOut, '/sign-in'],
    ['a signed-in user', respond.refreshSignedIn, '/app'],
  ])('open the right page from the root address for %s', async (_who, refresh, expected) => {
    server.use(refresh(), respond.profile());

    const { router } = renderApp('/');

    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toBe(expected);
  });

  it('restore the session once, however often the user moves between pages', async () => {
    let refreshes = 0;
    server.use(
      http.post(endpoints.refresh, () => {
        refreshes += 1;
        return problem(401, 'INVALID_REFRESH_TOKEN', 'Your session has ended.');
      }),
    );
    const { user } = renderApp('/sign-in');
    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));

    await user.click(nav.getByRole('link', { name: 'Create account' }));
    await screen.findByRole('heading', { level: 1, name: 'Create an account.' });
    await user.click(nav.getByRole('link', { name: 'Sign in' }));
    await screen.findByRole('heading', { level: 1, name: 'Sign in.' });

    expect(refreshes).toBe(1);
  });

  it('end the session when even a fresh access token is refused, instead of looping', async () => {
    let profileRequests = 0;
    server.use(
      respond.refreshSignedIn(),
      http.get(endpoints.me, () => {
        profileRequests += 1;
        return expiredToken();
      }),
    );

    const { router } = renderApp('/app');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in.' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(profileRequests).toBe(2);
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
  });

  it('let Back leave the sign-in page a guest was sent to', async () => {
    server.use(respond.refreshSignedOut());
    // A guest on sign-up opens /app, from a bookmark say, and is sent to sign in.
    const { router } = renderApp('/app', ['/sign-up']);
    await screen.findByRole('heading', { level: 1, name: 'Sign in.' });

    await goBack(router);

    expect(router.state.location.pathname).toBe('/sign-up');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create an account.');
  });

  it('let a signed-in user go Back past the sign-in page', async () => {
    server.use(respond.refreshSignedIn(), respond.profile());
    const { router } = renderApp('/app', ['/no-such-page', '/sign-in']);
    await screen.findByRole('heading', { level: 1, name: WELCOME });

    // Back to sign-in, which sends a signed-in user on to the app...
    await goBack(router);
    expect(router.state.location.pathname).toBe('/app');

    // ...and Back once more passes it, instead of landing on sign-in again.
    await goBack(router);
    expect(router.state.location.pathname).toBe('/no-such-page');
  });

  it('follow a sign-out in another tab', async () => {
    server.use(respond.refreshSignedIn(), respond.profile());
    const { router } = renderApp('/app');
    await screen.findByRole('heading', { level: 1, name: WELCOME });

    otherTab().announce('signed-out');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in.' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
  });

  it('follow a sign-in in another tab, picking up the session from the shared cookie', async () => {
    server.use(respond.refreshSignedOut());
    const { router } = renderApp('/sign-in');
    await screen.findByRole('heading', { level: 1, name: 'Sign in.' });
    server.use(respond.refreshSignedIn(), respond.profile());

    otherTab().announce('signed-in');

    expect(await screen.findByRole('heading', { level: 1, name: WELCOME })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('offer to try again when the session cannot be checked, then carry on', async () => {
    expectConsoleError(/ApiError: The service is unavailable/);
    server.use(
      http.post(endpoints.refresh, () =>
        problem(503, 'SERVICE_UNAVAILABLE', 'The service is unavailable.'),
      ),
    );
    const { user, router } = renderApp('/app');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We can't reach the server right now. Please try again in a moment."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
    expect(sessionStore.get()).toEqual({ status: 'unknown' });

    server.use(respond.refreshSignedIn(), respond.profile());
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    const welcome = await screen.findByRole('heading', { level: 1, name: WELCOME });
    expect(router.state.location.pathname).toBe('/app');
    // The button went with the error page; focus moves to the page that took its place.
    await waitFor(() => expect(welcome).toHaveFocus());
  });

  it('suggest a reload when a page fails for any other reason', async () => {
    expectConsoleError(/ApiError: The server sent an answer we could not read/);
    server.use(
      respond.refreshSignedIn(),
      http.get(endpoints.me, () => HttpResponse.json({ unexpected: true })),
    );

    renderApp('/app');

    expect(
      await screen.findByText('The page could not be loaded. Reloading usually helps.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    expect(document.title).toBe('Something went wrong · Auth Module');
  });

  it('move focus to the new page heading after a navigation, but not on the first load', async () => {
    server.use(respond.refreshSignedOut());
    const { user } = renderApp('/sign-in');
    const signIn = await screen.findByRole('heading', { level: 1, name: 'Sign in.' });
    expect(signIn).not.toHaveFocus();

    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    await user.click(nav.getByRole('link', { name: 'Create account' }));

    const signUp = await screen.findByRole('heading', { level: 1, name: 'Create an account.' });
    await waitFor(() => expect(signUp).toHaveFocus());
  });

  it('mark the current page in the masthead index', async () => {
    server.use(respond.refreshSignedOut());

    renderApp('/sign-up');

    const nav = within(await screen.findByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(nav.getByRole('link', { name: 'Sign in' })).not.toHaveAttribute('aria-current');
  });

  it('answer an unknown address with a not-found page', async () => {
    server.use(respond.refreshSignedOut());

    renderApp('/no-such-page');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Not in the index.' }),
    ).toBeInTheDocument();
  });
});
