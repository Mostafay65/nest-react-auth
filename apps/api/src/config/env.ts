import { z } from 'zod';

const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Browsers send `Origin: https://app.example.com`, so a path or trailing slash would never match. */
const origin = z
  .url({ protocol: /^https?$/, error: 'Must be an http(s) URL' })
  .refine((value) => new URL(value).origin === value, {
    error: 'Must be a bare origin such as https://app.example.com (no path or trailing slash)',
  });

/**
 * Secrets this repository has published: the .env.example placeholder, and the
 * fallback an earlier docker-compose.yml used. Fine on a laptop; refused in production.
 */
const PUBLISHED_SECRETS: readonly string[] = [
  'replace-me-with-a-long-random-string-of-at-least-32-characters',
  'local-compose-secret-replace-outside-local-runs',
];
const MISSING_SECRET =
  'Missing. Set a random string of at least 32 characters: openssl rand -base64 48';

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .pipe(z.array(origin));

/** Every setting the API reads. The process refuses to start if any of them is invalid. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MONGODB_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, { error: 'Must start with mongodb:// or mongodb+srv://' }),
    JWT_ACCESS_SECRET: z
      .string({ error: MISSING_SECRET })
      .min(1, { error: MISSING_SECRET, abort: true })
      .min(32, { error: 'Must be at least 32 characters long' }),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
    /** Set to false only for local development over plain HTTP. */
    COOKIE_SECURE: flag.default(true),
    /** Number of reverse proxies in front of the API, so rate limits see the real client IP. */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    /** Comma-separated origins allowed to call the API cross-origin. Empty means same-origin only. */
    CORS_ORIGINS: originList.default([]),
    /** On by default, except in production: there the docs are served only when set to true. */
    SWAGGER_ENABLED: flag.optional(),
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || !PUBLISHED_SECRETS.includes(env.JWT_ACCESS_SECRET),
    {
      path: ['JWT_ACCESS_SECRET'],
      error: 'This secret is published in the repository. Generate one: openssl rand -base64 48',
    },
  )
  .transform(({ SWAGGER_ENABLED, ...env }) => ({
    ...env,
    SWAGGER_ENABLED: SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
