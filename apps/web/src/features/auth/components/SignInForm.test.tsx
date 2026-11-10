import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { endpoints, problem, respond, server, sessionFor } from '@/test/api';
import { renderApp } from '@/test/render-app';

async function signInWith(email: string, password: string) {
  const rendered = renderApp('/sign-in');
  const { user } = rendered;
  await screen.findByRole('heading', { level: 1, name: 'Sign in.' });
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return rendered;
}

describe('Sign-in form', () => {
  beforeEach(() => {
    server.use(respond.refreshSignedOut());
  });

  it('opens the application with the new session', async () => {
    server.use(
      http.post(endpoints.signIn, () => HttpResponse.json(sessionFor('access-1'))),
      respond.profile(),
    );

    const { router } = await signInWith('ada@example.com', 'Analytical1!');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
    expect(document.title).toBe('Welcome · Auth Module');
  });

  it('says the email or password is wrong, without saying which', async () => {
    server.use(
      http.post(endpoints.signIn, () =>
        problem(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.'),
      ),
    );

    await signInWith('ada@example.com', 'not-my-password');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The email or password is incorrect.');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText('Email')).toBeValid();
  });

  it('asks the user to wait when the API is rate limiting', async () => {
    server.use(
      http.post(endpoints.signIn, () =>
        problem(429, 'RATE_LIMITED', 'Too many requests. Please wait a minute and try again.'),
      ),
    );

    await signInWith('ada@example.com', 'guess-1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts from this network. Please wait a minute, then try again.',
    );
  });

  it('does not send a malformed email', async () => {
    let called = false;
    server.use(
      http.post(endpoints.signIn, () => {
        called = true;
        return HttpResponse.json(sessionFor('access-1'));
      }),
    );

    await signInWith('ada@', 'Analytical1!');

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a valid email address',
    );
    expect(called).toBe(false);
  });

  it('sets the page title', async () => {
    renderApp('/sign-in');

    await screen.findByRole('heading', { level: 1, name: 'Sign in.' });
    expect(document.title).toBe('Sign in · Auth Module');
  });
});
