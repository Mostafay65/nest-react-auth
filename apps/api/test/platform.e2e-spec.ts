import type { NestExpressApplication } from '@nestjs/platform-express';
import { apiClient, AUTH, databaseOf, newUser, signUp, startTestApp } from './support/e2e.js';

/** The part of an OpenAPI operation these tests read. */
interface Operation {
  responses: Record<string, { content?: unknown; headers?: unknown }>;
}

describe('HTTP platform (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health check', () => {
    it('reports the API and MongoDB as up, without caching', async () => {
      const response = await apiClient(app)
        .get('/api/health')
        .expect(200)
        .expect('Cache-Control', 'no-cache, no-store, must-revalidate');

      expect(response.body).toMatchObject({ status: 'ok', info: { mongodb: { status: 'up' } } });
    });

    it('is never rate limited', async () => {
      const client = apiClient(app);
      for (let attempt = 0; attempt < 110; attempt += 1) {
        await client.get('/api/health').expect(200);
      }
    });
  });

  describe('security headers', () => {
    it('sends hardened headers and hides the framework', async () => {
      const response = await apiClient(app).get('/api/health');

      expect(response.headers).toMatchObject({
        'content-security-policy': expect.stringContaining("default-src 'self'"),
        'strict-transport-security': expect.stringContaining('max-age='),
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'no-referrer',
      });
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });

    it('lets no browser or proxy keep a copy of a response', async () => {
      const client = apiClient(app);
      const { accessToken } = await signUp(client);
      const profile = await client
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      // Rejected before routing, so this covers every response, not just the routes.
      const malformed = await client
        .post(`${AUTH}/sign-in`)
        .set('Content-Type', 'application/json')
        .send('{')
        .expect(400);

      for (const response of [profile, malformed]) {
        expect(response.get('Cache-Control')).toBe('no-store');
        expect(response.get('ETag')).toBeUndefined();
      }
    });
  });

  describe('request IDs', () => {
    it('gives every response an ID, also inside error bodies', async () => {
      const response = await apiClient(app).get('/api/v1/users/me').expect(401);

      const requestId = response.get('X-Request-Id');
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.body.requestId).toBe(requestId);
    });

    it("keeps a caller's ID when it is safe to log", async () => {
      await apiClient(app)
        .get('/api/health')
        .set('X-Request-Id', 'gateway-42')
        .expect('X-Request-Id', 'gateway-42');
    });
  });

  describe('errors', () => {
    it('answers unknown routes with problem+json', async () => {
      const response = await apiClient(app)
        .get('/api/v1/nope')
        .expect(404)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Cannot GET /api/v1/nope',
        instance: '/api/v1/nope',
        code: 'NOT_FOUND',
        requestId: expect.any(String),
      });
    });

    it('rejects a body that is not valid JSON without echoing it', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-in`)
        .set('Content-Type', 'application/json')
        .send('{"email": "ada@example.com", ')
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'MALFORMED_REQUEST',
        detail: 'The request body is not valid JSON.',
        requestId: response.get('X-Request-Id'),
      });
    });

    it('asks for a JSON object when the body is something else', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-in`)
        .type('form')
        .send('email=ada@example.com&password=secret')
        .expect(400);

      expect(response.body.errors).toEqual([{ message: 'The request body must be a JSON object' }]);
    });

    it('asks for UTF-8 when the body declares another charset', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-in`)
        .set('Content-Type', 'application/json; charset=latin1')
        .send('{"email": "ada@example.com", "password": "Analytical1!"}')
        .expect(415);

      expect(response.body).toMatchObject({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        detail: 'The request body must be JSON encoded as UTF-8.',
      });
    });

    it('rejects a body over 10 kB', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-up`)
        .send(newUser({ name: 'a'.repeat(11 * 1_024) }))
        .expect(413);

      expect(response.body).toMatchObject({
        code: 'PAYLOAD_TOO_LARGE',
        detail: 'The request body is too large.',
      });
    });
  });

  describe('cross-site request protection', () => {
    it('rejects a write sent from another site', async () => {
      const response = await apiClient(app)
        .post(`${AUTH}/sign-in`)
        .set('Sec-Fetch-Site', 'cross-site')
        .send({ email: 'ada@example.com', password: 'Analytical1!' })
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('rejects a write from a foreign Origin when the browser sends no Sec-Fetch-Site', async () => {
      await apiClient(app)
        .post(`${AUTH}/sign-out`)
        .set('Origin', 'https://evil.example')
        .expect(403);
    });

    it('accepts the same request from the app itself', async () => {
      await apiClient(app)
        .post(`${AUTH}/sign-out`)
        .set('Sec-Fetch-Site', 'same-origin')
        .expect(204);
    });
  });

  describe('rate limiting', () => {
    it('allows 10 sign-in attempts per minute from one IP address, then answers 429', async () => {
      const attacker = apiClient(app);
      const attempt = () =>
        attacker.post(`${AUTH}/sign-in`).send({ email: 'ada@example.com', password: 'guess' });

      for (let count = 1; count <= 10; count += 1) {
        await attempt().expect(401);
      }
      const blocked = await attempt().expect(429);

      expect(blocked.body).toMatchObject({
        code: 'RATE_LIMITED',
        detail: 'Too many requests. Please wait a minute and try again.',
      });
      expect(Number(blocked.get('Retry-After'))).toBeGreaterThan(0);
      // Other clients are not affected.
      await apiClient(app)
        .post(`${AUTH}/sign-in`)
        .send({ email: 'ada@example.com', password: 'guess' })
        .expect(401);
    });
  });

  describe('API documentation', () => {
    it('serves the OpenAPI document with every endpoint', async () => {
      const response = await apiClient(app).get('/api/docs/openapi.json').expect(200);

      expect(Object.keys(response.body.paths).sort()).toEqual([
        '/api/health',
        '/api/v1/auth/refresh',
        '/api/v1/auth/sign-in',
        '/api/v1/auth/sign-out',
        '/api/v1/auth/sign-up',
        '/api/v1/users/me',
      ]);
    });

    it('states the real field rules, not looser ones', async () => {
      const { body } = await apiClient(app).get('/api/docs/openapi.json').expect(200);
      const { properties } =
        body.paths[`${AUTH}/sign-up`].post.requestBody.content['application/json'].schema;

      expect(properties.email).toMatchObject({ format: 'email', maxLength: 254 });
      expect(properties.name).toMatchObject({ minLength: 3, maxLength: 50 });
      expect(properties.password).toMatchObject({ minLength: 8, maxLength: 128 });
    });

    it('describes every error with one shared problem+json schema', async () => {
      const { body } = await apiClient(app).get('/api/docs/openapi.json').expect(200);
      const operations = Object.values<Record<string, Operation>>(body.paths).flatMap((path) =>
        Object.values(path),
      );
      const errors = operations.flatMap((operation) =>
        Object.entries(operation.responses).filter(
          ([status]) => status === 'default' || Number(status) >= 400,
        ),
      );

      expect(body.components.schemas.ProblemDetails.required).toEqual(
        expect.arrayContaining(['type', 'title', 'status', 'detail', 'instance', 'code']),
      );
      expect(errors.length).toBeGreaterThan(10);
      for (const [, response] of errors) {
        expect(response.content).toEqual({
          'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        });
      }
    });

    it('documents the headers clients act on, and a problem body for any other status', async () => {
      const { body } = await apiClient(app).get('/api/docs/openapi.json').expect(200);
      const signIn = body.paths[`${AUTH}/sign-in`].post as Operation;

      expect(signIn.responses['200']?.headers).toHaveProperty('Set-Cookie');
      expect(signIn.responses['429']?.headers).toHaveProperty('Retry-After');
      for (const [path, operations] of Object.entries<Record<string, Operation>>(body.paths)) {
        for (const operation of Object.values(operations)) {
          expect(Object.keys(operation.responses), path).toContain('default');
        }
      }
    });

    it('documents the answers any write can get before its handler runs', async () => {
      const { body } = await apiClient(app).get('/api/docs/openapi.json').expect(200);

      for (const route of ['sign-up', 'sign-in', 'refresh', 'sign-out']) {
        const { responses } = body.paths[`${AUTH}/${route}`].post as Operation;
        expect(Object.keys(responses), route).toEqual(
          expect.arrayContaining(['403', '413', '415', '429']),
        );
      }
    });

    it('serves Swagger UI', async () => {
      const response = await apiClient(app).get('/api/docs').expect(200);

      expect(response.text).toContain('swagger-ui');
    });
  });

  describe('database indexes', () => {
    it('enforces unique emails and expires refresh tokens automatically', async () => {
      const db = databaseOf(app);
      // Mongoose builds indexes in the background when the app starts.
      await Promise.all(Object.values(db.models).map((model) => model.init()));

      const users = await db.collection('users').indexes();
      const tokens = await db.collection('refresh_tokens').indexes();

      expect(users).toContainEqual(expect.objectContaining({ key: { email: 1 }, unique: true }));
      expect(tokens).toContainEqual(
        expect.objectContaining({ key: { tokenHash: 1 }, unique: true }),
      );
      expect(tokens).toContainEqual(
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
      );
      expect(tokens).toContainEqual(expect.objectContaining({ key: { familyId: 1 } }));
    });
  });
});
