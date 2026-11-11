import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

const APP_ORIGIN = 'https://app.example.com';

// AppModule validates the environment when it is first imported, so the origin is
// set before the app is loaded, which is why the import below is dynamic.
process.env.CORS_ORIGINS = APP_ORIGIN;
const { apiClient, AUTH, newUser, startTestApp } = await import('./support/e2e.js');

describe('Cross-origin clients (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const preflight = (origin: string) =>
    request(app.getHttpServer())
      .options(`${AUTH}/sign-in`)
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

  it('lets a listed origin send credentials', async () => {
    const response = await preflight(APP_ORIGIN).expect(204);

    expect(response.headers).toMatchObject({
      'access-control-allow-origin': APP_ORIGIN,
      'access-control-allow-credentials': 'true',
    });
  });

  it('accepts a write from a listed origin and lets it read the request ID', async () => {
    const response = await apiClient(app)
      .post(`${AUTH}/sign-up`)
      .set('Origin', APP_ORIGIN)
      .set('Sec-Fetch-Site', 'cross-site')
      .send(newUser())
      .expect(201);

    expect(response.get('Access-Control-Allow-Origin')).toBe(APP_ORIGIN);
    expect(response.get('Access-Control-Expose-Headers')).toBe('X-Request-Id');
  });

  it('gives any other origin no CORS headers and refuses its writes', async () => {
    const response = await preflight('https://evil.example');
    expect(response.get('Access-Control-Allow-Origin')).toBeUndefined();

    await apiClient(app)
      .post(`${AUTH}/sign-in`)
      .set('Origin', 'https://evil.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ email: 'ada@example.com', password: 'Analytical1!' })
      .expect(403);
  });
});
