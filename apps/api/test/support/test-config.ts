import { ConfigService } from '@nestjs/config';
import { type Env, validateEnv } from '../../src/config/env.js';

/** Settings for unit tests, validated exactly like the real environment. */
export function createTestConfig(
  overrides: Partial<Record<keyof Env, string>> = {},
): ConfigService<Env, true> {
  return new ConfigService<Env, true>(
    validateEnv({
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/unit-tests',
      JWT_ACCESS_SECRET: 'a-unit-test-secret-of-at-least-32-characters',
      ...overrides,
    }),
  );
}
