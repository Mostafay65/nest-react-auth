import { readFileSync } from 'node:fs';
import { validateEnv } from './env.js';

const required = {
  MONGODB_URI: 'mongodb://localhost:27017/nest-react-auth',
  JWT_ACCESS_SECRET: 'a-secret-that-is-at-least-32-characters-long',
};

describe('validateEnv', () => {
  it('fills in safe defaults for everything optional', () => {
    expect(validateEnv(required)).toEqual({
      ...required,
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      ACCESS_TOKEN_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 604_800,
      COOKIE_SECURE: true,
      TRUST_PROXY: 0,
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: true,
    });
  });

  it('converts numbers, flags and the origin list', () => {
    const env = validateEnv({
      ...required,
      PORT: '8080',
      COOKIE_SECURE: 'false',
      CORS_ORIGINS: 'https://app.example.com, http://localhost:5173',
    });

    expect(env).toMatchObject({
      PORT: 8080,
      COOKIE_SECURE: false,
      CORS_ORIGINS: ['https://app.example.com', 'http://localhost:5173'],
    });
  });

  it('refuses to start without the required settings, naming each one', () => {
    expect(() => validateEnv({})).toThrow(/MONGODB_URI[\s\S]*JWT_ACCESS_SECRET/);
  });

  it('explains how to make a secret when it is missing or empty', () => {
    expect(() => validateEnv({ ...required, JWT_ACCESS_SECRET: '' })).toThrow(
      /Missing\. Set a random string of at least 32 characters[\s\S]*at JWT_ACCESS_SECRET/,
    );
  });

  describe('the example secret from .env.example', () => {
    const example = /^JWT_ACCESS_SECRET=(\S+)$/m.exec(
      readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'),
    )?.[1];

    it('is accepted for local development, so the quick start works as written', () => {
      expect(validateEnv({ ...required, JWT_ACCESS_SECRET: example }).JWT_ACCESS_SECRET).toBe(
        example,
      );
    });

    it('stops the API from starting in production', () => {
      expect(() =>
        validateEnv({ ...required, NODE_ENV: 'production', JWT_ACCESS_SECRET: example }),
      ).toThrow(/published in the repository[\s\S]*at JWT_ACCESS_SECRET/);
    });
  });

  it('refuses in production the fallback secret an earlier docker-compose.yml used', () => {
    expect(() =>
      validateEnv({
        ...required,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'local-compose-secret-replace-outside-local-runs',
      }),
    ).toThrow(/published in the repository/);
  });

  it('serves the API docs by default, except in production', () => {
    expect(validateEnv({ ...required, NODE_ENV: 'production' }).SWAGGER_ENABLED).toBe(false);
    expect(
      validateEnv({ ...required, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED,
    ).toBe(true);
    expect(validateEnv({ ...required, NODE_ENV: 'test' }).SWAGGER_ENABLED).toBe(true);
  });

  it.each([
    ['a short JWT secret', { JWT_ACCESS_SECRET: 'too-short' }, /at least 32 characters/],
    ['a URI that is not MongoDB', { MONGODB_URI: 'postgres://db/app' }, /mongodb:\/\//],
    ['a flag that is not true or false', { COOKIE_SECURE: 'yes' }, /COOKIE_SECURE/],
    ['an origin with a path', { CORS_ORIGINS: 'https://app.example.com/' }, /bare origin/],
    ['an origin that is not http(s)', { CORS_ORIGINS: 'ftp://files.example.com' }, /http\(s\)/],
  ])('rejects %s', (_label, overrides, message) => {
    expect(() => validateEnv({ ...required, ...overrides })).toThrow(message);
  });
});
