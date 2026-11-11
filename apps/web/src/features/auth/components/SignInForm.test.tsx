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

  it('says the email or password is wrong, without saying which, in its own words', async () => {
    server.use(
      http.post(endpoints.signIn, () =>
        problem(401, 'INVALID_CREDENTIALS', 'Credentials rejected by the auth service.'),
      ),
    );

    await signInWith('ada@example.com', 'not-my-password');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The email or password is incorrect.');
    expect(alert).not.toHaveTextContent('Credentials rejected');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText('Email')).toBeValid();
  });

  it('keeps focus on the button while signing in, and signs in once however often it is pressed', async () => {
    // The server holds its answer until the test has pressed the button again.
    let answer = () => {};
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    let requests = 0;
    server.use(
      http.post(endpoints.signIn, async () => {
        requests += 1;
        await answered;
        return problem(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');
      }),
    );

    const { user } = await signInWith('ada@example.com', 'Analytical1!');

    const button = screen.getByRole('button', { name: 'Signing in…' });
    expect(button).toHaveFocus();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    await user.type(screen.getByLabelText('Password'), '{Enter}');
    answer();

    await screen.findByRole('alert');
    expect(requests).toBe(1);
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toHaveAttribute('aria-disabled');
  });

  it('lets password managers fill and save the email as the username', async () => {
    renderApp('/sign-in');

    expect(await screen.findByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
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
