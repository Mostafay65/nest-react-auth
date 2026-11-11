import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ada, endpoints, problem, respond, server, sessionFor } from '@/test/api';
import { renderApp } from '@/test/render-app';

const checklist = () =>
  within(screen.getByRole('list', { name: 'Your password needs' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

async function openSignUp() {
  const rendered = renderApp('/sign-up');
  await screen.findByRole('heading', { level: 1, name: 'Create an account.' });
  return rendered;
}

describe('Sign-up form', () => {
  beforeEach(() => {
    server.use(respond.refreshSignedOut());
  });

  it('explains each invalid field and moves focus to the first one', async () => {
    const { user } = await openSignUp();

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const name = screen.getByLabelText('Name');
    expect(name).toHaveFocus();
    expect(name).toBeInvalid();
    expect(name).toHaveAccessibleDescription('Name is required');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Email is required');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      expect.stringContaining('Password is required'),
    );
  });

  it('checks the email format before sending anything', async () => {
    const { user } = await openSignUp();

    await user.type(screen.getByLabelText('Email'), 'ada-at-example.com');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a valid email address',
    );
  });

  it('ticks off the password rules as the user types', async () => {
    const { user } = await openSignUp();
    const password = screen.getByLabelText('Password');

    await user.type(password, 'abc');
    expect(checklist()).toEqual([
      'At least 8 characters, not yet',
      'One letter, done',
      'One number, not yet',
      'One special character, not yet',
    ]);

    await user.type(password, '12345!');
    expect(checklist()).toEqual([
      'At least 8 characters, done',
      'One letter, done',
      'One number, done',
      'One special character, done',
    ]);
    expect(screen.getByText('4 of 4 password rules met')).toBeInTheDocument();
  });

  it('judges the password as the API does, after normalising it', async () => {
    const { user } = await openSignUp();
    await user.click(screen.getByLabelText('Password'));

    // Eleven code points as typed, but each "e" and its accent become one "é": seven in all.
    await user.paste('é'.repeat(4) + 'a1!');

    expect(checklist()[0]).toBe('At least 8 characters, not yet');
  });

  it('lets the user see the password they typed', async () => {
    const { user } = await openSignUp();
    const password = screen.getByLabelText('Password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('puts "email already registered" on the email field, in its own words', async () => {
    server.use(
      http.post(endpoints.signUp, () =>
        problem(409, 'EMAIL_ALREADY_REGISTERED', 'Duplicate key: users.email_1'),
      ),
    );
    const { user } = await openSignUp();

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Analytical1!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const email = screen.getByLabelText('Email');
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAccessibleDescription('An account with this email already exists.');
  });

  it('shows rules the server enforced on the matching field', async () => {
    server.use(
      http.post(endpoints.signUp, () =>
        problem(400, 'VALIDATION_FAILED', 'The request is invalid.', [
          { field: 'password', message: 'Password must contain at least one number' },
          { field: 'password', message: 'Password must be at least 8 characters long' },
        ]),
      ),
    );
    const { user } = await openSignUp();

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Analytical1!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const password = screen.getByLabelText('Password');
    await waitFor(() => expect(password).toHaveFocus());
    expect(password).toHaveAccessibleDescription(
      expect.stringContaining('Password must contain at least one number'),
    );
  });

  it('explains a rejection the server could not pin on a field, in its own words', async () => {
    server.use(
      http.post(endpoints.signUp, () =>
        problem(400, 'VALIDATION_FAILED', 'The request is invalid.'),
      ),
    );
    const { user } = await openSignUp();

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Analytical1!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some of these details were not accepted. Check them and try again.',
    );
  });

  it('lets password managers save the email as the username, with the new password', async () => {
    await openSignUp();

    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('says so calmly when the server cannot be reached', async () => {
    server.use(http.post(endpoints.signUp, () => HttpResponse.error()));
    const { user } = await openSignUp();

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Analytical1!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'We could not reach the server. Check your connection and try again.',
    );
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('sends the normalised details and opens the application', async () => {
    let sent: unknown;
    server.use(
      http.post(endpoints.signUp, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(sessionFor('new-token'), { status: 201 });
      }),
      http.get(endpoints.me, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new-token'
          ? HttpResponse.json(ada)
          : problem(401, 'UNAUTHORIZED', 'The access token is invalid or has expired.'),
      ),
    );
    const { user, router } = await openSignUp();

    await user.type(screen.getByLabelText('Name'), '  Ada Lovelace ');
    await user.type(screen.getByLabelText('Email'), 'Ada@Example.com');
    await user.type(screen.getByLabelText('Password'), 'Analytical1!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
    expect(sent).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Analytical1!',
    });
  });
});
