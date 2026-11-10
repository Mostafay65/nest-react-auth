import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { endpoints, problem, respond, server } from '@/test/api';
import { renderApp } from '@/test/render-app';

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

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('send a signed-in user away from sign-up too', async () => {
    server.use(respond.refreshSignedIn(), respond.profile());

    const { router } = renderApp('/sign-up');

    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });
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
