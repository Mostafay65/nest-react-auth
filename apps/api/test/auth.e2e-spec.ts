import type { NestExpressApplication } from '@nestjs/platform-express';
import { type Connection, Types } from 'mongoose';
import {
  apiClient,
  AUTH,
  databaseOf,
  newUser,
  readCookie,
  refreshCookie,
  refreshTokenFrom,
  signUp,
  startTestApp,
} from './support/e2e.js';

describe('Auth API (e2e)', () => {
  let app: NestExpressApplication;
  let db: Connection;

  beforeAll(async () => {
    app = await startTestApp();
    db = databaseOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/sign-up', () => {
    it('creates the account, returns an access token and sets the refresh cookie', async () => {
      const body = newUser();

      const response = await apiClient(app).post(`${AUTH}/sign-up`).send(body).expect(201);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: expect.stringMatching(/^[0-9a-f]{24}$/),
          email: body.email,
          name: body.name,
          createdAt: expect.any(String),
        },
      });
      expect(readCookie(response)).toEqual({
        value: expect.stringMatching(/^[\w-]{43}$/),
        attributes: {
          path: '/api/v1/auth',
          'max-age': '604800',
          httponly: true,
          secure: true,
          samesite: 'Strict',
        },
      });
    });

    it('stores the email trimmed and lower-cased, and the password as an argon2id hash', async () => {
      const body = newUser();
      const typed = `  ${body.email.toUpperCase()} `;

      const response = await apiClient(app)
        .post(`${AUTH}/sign-up`)
        .send({ ...body, email: typed })
        .expect(201);

      expect(response.body.user.email).toBe(body.email);
      const stored = await db.collection('users').findOne({ email: body.email });
      expect(stored?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(JSON.stringify(stored)).not.toContain(body.password);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it.each([
      ['an invalid email', { email: 'ada-at-example.com' }, 'email', 'Enter a valid email address'],
      [
        'a name under 3 characters',
        { name: 'Al' },
        'name',
        'Name must be at least 3 characters long',
      ],
      ['a name of spaces', { name: '     ' }, 'name', 'Name is required'],
      [
        'a password under 8 characters',
        { password: 'Ab1!' },
        'password',
        'Password must be at least 8 characters long',
      ],
      [
        'a password without a letter',
        { password: '12345678!' },
        'password',
        'Password must contain at least one letter',
      ],
      [
        'a password without a number',
        { password: 'Analytical!' },
        'password',
        'Password must contain at least one number',
      ],
      [
        'a password without a special character',
        { password: 'Analytical1' },
        'password',
        'Password must contain at least one special character, such as ! ? # or @',
      ],
    ])('rejects %s', async (_label, overrides, field, message) => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-up`)
        .send(newUser(overrides))
        .expect(400)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({
        status: 400,
        code: 'VALIDATION_FAILED',
        errors: [{ field, message }],
      });
    });

    it('lists every invalid field in one response', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-up`)
        .send({ email: 'nope', name: 'Al', password: 'short' })
        .expect(400);

      expect(response.body.errors).toEqual([
        { field: 'email', message: 'Enter a valid email address' },
        { field: 'name', message: 'Name must be at least 3 characters long' },
        { field: 'password', message: 'Password must be at least 8 characters long' },
        { field: 'password', message: 'Password must contain at least one number' },
        {
          field: 'password',
          message: 'Password must contain at least one special character, such as ! ? # or @',
        },
      ]);
    });

    it('rejects fields it does not know, such as a role', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-up`)
        .send({ ...newUser(), role: 'admin' })
        .expect(400);

      expect(response.body.errors).toEqual([{ message: 'Unrecognized key: "role"' }]);
    });

    it('rejects MongoDB operators in place of values', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-up`)
        .send({ ...newUser(), email: { $gt: '' } })
        .expect(400);

      expect(response.body.errors).toEqual([{ field: 'email', message: 'Email must be a string' }]);
    });

    it('refuses an email that is already registered, whatever its letter case', async () => {
      const client = apiClient(app);
      const { body } = await signUp(client);

      const response = await client
        .post(`${AUTH}/sign-up`)
        .send(newUser({ email: body.email.toUpperCase() }))
        .expect(409);

      expect(response.body).toMatchObject({
        code: 'EMAIL_ALREADY_REGISTERED',
        detail: 'An account with this email already exists.',
      });
      expect(await db.collection('users').countDocuments({ email: body.email })).toBe(1);
    });

    it('creates one account when the same email signs up twice at once', async () => {
      const body = newUser();

      const responses = await Promise.all([
        apiClient(app).post(`${AUTH}/sign-up`).send(body),
        apiClient(app).post(`${AUTH}/sign-up`).send(body),
      ]);

      expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      expect(await db.collection('users').countDocuments({ email: body.email })).toBe(1);
    });
  });

  describe('POST /api/v1/auth/sign-in', () => {
    it('signs in with the email in any letter case', async () => {
      const client = apiClient(app);
      const { body, userId } = await signUp(client);

      const response = await client
        .post(`${AUTH}/sign-in`)
        .send({ email: body.email.toUpperCase(), password: body.password })
        .expect(200);

      expect(response.body).toMatchObject({ tokenType: 'Bearer', user: { id: userId } });
      expect(refreshTokenFrom(response)).toMatch(/^[\w-]{43}$/);
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const client = apiClient(app);
      const { body } = await signUp(client);

      const wrongPassword = await client
        .post(`${AUTH}/sign-in`)
        .send({ email: body.email, password: 'Wrong-password-1' })
        .expect(401);
      const unknownEmail = await client
        .post(`${AUTH}/sign-in`)
        .send({ email: 'nobody@example.com', password: body.password })
        .expect(401);

      const comparable = ({ requestId: _requestId, ...rest }: Record<string, unknown>) => rest;
      expect(comparable(wrongPassword.body)).toEqual(comparable(unknownEmail.body));
      expect(wrongPassword.body).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        detail: 'The email or password is incorrect.',
      });
      expect(readCookie(wrongPassword)).toBeUndefined();
    });

    it('does not apply the sign-up password rules', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-in`)
        .send({ email: 'ada@example.com', password: 'short' })
        .expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects MongoDB operators instead of matching any account', async () => {
      const client = apiClient(app);
      await signUp(client);

      const response = await client
        .post(`${AUTH}/sign-in`)
        .send({ email: { $ne: null }, password: { $ne: null } })
        .expect(400);

      expect(response.body.errors).toEqual([
        { field: 'email', message: 'Email must be a string' },
        { field: 'password', message: 'Password must be a string' },
      ]);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns a new access token and rotates the refresh cookie', async () => {
      const client = apiClient(app);
      const session = await signUp(client);

      const response = await client
        .post(`${AUTH}/refresh`)
        .set('Cookie', refreshCookie(session.refreshToken))
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        user: { id: session.userId, email: session.body.email },
      });
      const rotated = refreshTokenFrom(response);
      expect(rotated).not.toBe(session.refreshToken);
      await client.post(`${AUTH}/refresh`).set('Cookie', refreshCookie(rotated)).expect(200);
    });

    it('revokes the whole session when a refresh token is used twice', async () => {
      const client = apiClient(app);
      const session = await signUp(client);
      const firstUse = await client
        .post(`${AUTH}/refresh`)
        .set('Cookie', refreshCookie(session.refreshToken))
        .expect(200);
      const latest = refreshTokenFrom(firstUse);

      const replay = await client
        .post(`${AUTH}/refresh`)
        .set('Cookie', refreshCookie(session.refreshToken))
        .expect(401);

      expect(replay.body.code).toBe('INVALID_REFRESH_TOKEN');
      // The legitimate holder of the newest token is signed out too.
      await client.post(`${AUTH}/refresh`).set('Cookie', refreshCookie(latest)).expect(401);
      expect(
        await db
          .collection('refresh_tokens')
          .countDocuments({ userId: toObjectId(session.userId) }),
      ).toBe(0);
    });

    it('ends the session when the same refresh token is sent twice at once', async () => {
      const client = apiClient(app);
      const session = await signUp(client);
      const exchange = () =>
        client.post(`${AUTH}/refresh`).set('Cookie', refreshCookie(session.refreshToken));

      const responses = await Promise.all([exchange(), exchange()]);

      // One exchange wins and the other counts as reuse. The reuse revokes the
      // session, including the token the winner was just given.
      expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([
        200, 401,
      ]);
      expect(
        await db
          .collection('refresh_tokens')
          .countDocuments({ userId: toObjectId(session.userId) }),
      ).toBe(0);
    });

    it('clears the cookie when the token is not accepted', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/refresh`)
        .set('Cookie', refreshCookie('forged-token'))
        .expect(401);

      expect(response.body).toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
        detail: 'Your session has ended. Please sign in again.',
      });
      expect(readCookie(response)?.value).toBe('');
    });

    it('rejects a request without the cookie', async () => {
      const response = await apiClient(app).post(`${AUTH}/refresh`).expect(401);

      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('rejects an expired refresh token', async () => {
      const client = apiClient(app);
      const session = await signUp(client);
      await db
        .collection('refresh_tokens')
        .updateMany(
          { userId: toObjectId(session.userId) },
          { $set: { expiresAt: new Date(Date.now() - 1_000) } },
        );

      await client
        .post(`${AUTH}/refresh`)
        .set('Cookie', refreshCookie(session.refreshToken))
        .expect(401);
    });

    it('stores refresh tokens only as SHA-256 hashes', async () => {
      const client = apiClient(app);
      const session = await signUp(client);

      const stored = await db
        .collection('refresh_tokens')
        .find({ userId: toObjectId(session.userId) })
        .toArray();

      expect(stored).toHaveLength(1);
      expect(stored[0]?.tokenHash).toMatch(/^[\w-]{43}$/);
      expect(JSON.stringify(stored)).not.toContain(session.refreshToken);
    });
  });

  describe('POST /api/v1/auth/sign-out', () => {
    it('ends the session and clears the cookie', async () => {
      const client = apiClient(app);
      const session = await signUp(client);

      const response = await client
        .post(`${AUTH}/sign-out`)
        .set('Cookie', refreshCookie(session.refreshToken))
        .expect(204);

      expect(readCookie(response)).toMatchObject({
        value: '',
        attributes: { path: '/api/v1/auth', httponly: true, secure: true, samesite: 'Strict' },
      });
      await client
        .post(`${AUTH}/refresh`)
        .set('Cookie', refreshCookie(session.refreshToken))
        .expect(401);
    });

    it('can be called without a session', async () => {
      await apiClient(app).post(`${AUTH}/sign-out`).expect(204);
    });
  });
});

/** refresh_tokens.userId is stored as an ObjectId, not as a string. */
function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
