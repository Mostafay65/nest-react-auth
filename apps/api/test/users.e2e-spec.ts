import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/auth/jwt.options.js';
import { apiClient, signUp, startTestApp } from './support/e2e.js';

const ME = '/api/v1/users/me';

describe('GET /api/v1/users/me (e2e)', () => {
  let app: NestExpressApplication;
  /** Signs tokens with the app's own secret, to test claims the app must still refuse. */
  let jwt: JwtService;

  beforeAll(async () => {
    app = await startTestApp();
    jwt = new JwtService({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the profile of the signed-in user', async () => {
    const client = apiClient(app);
    const { body, userId, accessToken } = await signUp(client);

    const response = await client.get(ME).set('Authorization', `Bearer ${accessToken}`).expect(200);

    expect(response.body).toEqual({
      id: userId,
      email: body.email,
      name: body.name,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
  });

  it('asks for a bearer token when there is none', async () => {
    const response = await apiClient(app)
      .get(ME)
      .expect(401)
      .expect('WWW-Authenticate', 'Bearer')
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      code: 'UNAUTHORIZED',
      detail: 'Send an access token as `Authorization: Bearer <token>`.',
    });
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer a b'])(
    'rejects the malformed header %j',
    async (header) => {
      await apiClient(app).get(ME).set('Authorization', header).expect(401);
    },
  );

  describe('rejects a token that', () => {
    let userId: string;
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      ({ userId, accessToken, refreshToken } = await signUp(apiClient(app)));
    });

    const expectRejected = async (token: string) => {
      const response = await apiClient(app)
        .get(ME)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(response.body).toMatchObject({
        code: 'UNAUTHORIZED',
        detail: 'The access token is invalid or has expired.',
      });
    };

    it('was tampered with', async () => {
      const [header, payload = '', signature = ''] = accessToken.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      const forged = Buffer.from(JSON.stringify({ ...claims, sub: '0'.repeat(24) })).toString(
        'base64url',
      );

      await expectRejected(`${header}.${forged}.${signature}`);
    });

    it('was signed with another secret', async () => {
      const foreign = new JwtService({ secret: 'some-other-secret-that-is-32-characters-long' });

      await expectRejected(
        await foreign.signAsync({ sub: userId }, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }),
      );
    });

    it('is unsigned (alg: none)', async () => {
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const now = Math.floor(Date.now() / 1_000);
      const claims = { sub: userId, iss: JWT_ISSUER, aud: JWT_AUDIENCE, iat: now, exp: now + 900 };

      await expectRejected(`${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.`);
    });

    it('has expired', async () => {
      const issuedAt = Math.floor(Date.now() / 1_000) - 3_600;

      await expectRejected(
        await jwt.signAsync({ sub: userId, iat: issuedAt, exp: issuedAt + 900 }),
      );
    });

    it('was issued for another audience', async () => {
      await expectRejected(await jwt.signAsync({ sub: userId }, { audience: 'another-service' }));
    });

    it('is the refresh token', async () => {
      await expectRejected(refreshToken);
    });
  });

  it('reports an account that no longer exists', async () => {
    const jwtForGhost = await jwt.signAsync({ sub: 'ffffffffffffffffffffffff' });

    const response = await apiClient(app)
      .get(ME)
      .set('Authorization', `Bearer ${jwtForGhost}`)
      .expect(404);

    expect(response.body.code).toBe('NOT_FOUND');
  });
});
