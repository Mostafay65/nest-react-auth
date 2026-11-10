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
