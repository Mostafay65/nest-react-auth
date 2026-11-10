import { randomUUID } from 'node:crypto';
import { inject } from 'vitest';

const database = new URL(inject('mongoUri'));
database.pathname = `/e2e-${randomUUID()}`;

// AppModule validates the environment as soon as it is imported, so this runs first.
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  MONGODB_URI: database.toString(),
  JWT_ACCESS_SECRET: 'an-e2e-secret-that-is-at-least-32-characters',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_SECONDS: '604800',
  // The production cookie attributes, so the tests check what browsers will get.
  COOKIE_SECURE: 'true',
  // Clients set X-Forwarded-For, so each test can have its own IP for rate limiting.
  TRUST_PROXY: '1',
  CORS_ORIGINS: '',
  SWAGGER_ENABLED: 'true',
});
