import { createHash, randomBytes } from 'node:crypto';

/** 256 bits from the OS CSPRNG, base64url so it can go into a cookie as it is. */
export const generateRefreshToken = (): string => randomBytes(32).toString('base64url');

/**
 * The token has 256 bits of entropy, so a fast hash is safe here (unlike
 * passwords). Storing only the hash means a database leak exposes no
 * usable token.
 */
export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('base64url');
