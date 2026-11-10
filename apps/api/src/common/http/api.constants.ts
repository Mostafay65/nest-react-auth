/** Every route lives under /api; versioned routes add /v1. */
export const API_PREFIX = 'api';
export const API_VERSION = '1';

export const HEALTH_PATH = `/${API_PREFIX}/health`;
export const DOCS_PATH = `${API_PREFIX}/docs`;

/** The refresh token cookie is only sent to the auth routes, never to the rest of the API. */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const REFRESH_TOKEN_COOKIE_PATH = `/${API_PREFIX}/v${API_VERSION}/auth`;

/** Requests per client IP. Sign-in and sign-up are stricter, to slow down password guessing. */
export const RATE_LIMITS = {
  default: { ttl: 60_000, limit: 100 },
  credentials: { ttl: 60_000, limit: 10 },
} as const;
