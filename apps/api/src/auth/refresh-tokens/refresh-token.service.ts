import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { InvalidRefreshTokenError } from '../auth.errors.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.crypto.js';
import type { IssuedRefreshToken, StoredRefreshToken } from './refresh-token.js';
import { RefreshTokenRepository } from './refresh-token.repository.js';

/**
 * Refresh tokens with rotation and reuse detection (OAuth 2.0 Security BCP,
 * RFC 9700 §4.14.2). Each exchange returns a new token and retires the old
 * one. If a retired token comes back, it was stolen or replayed, so the whole
 * family is revoked and both the attacker and the user have to sign in again.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly ttlMs: number;

  constructor(
    private readonly tokens: RefreshTokenRepository,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TOKEN_TTL_SECONDS', { infer: true }) * 1_000;
  }

  /** Starts a new family, i.e. a new signed-in session. */
  issue(userId: string): Promise<IssuedRefreshToken> {
    return this.issueInFamily(userId, randomUUID());
  }

  /** @throws InvalidRefreshTokenError when the token is unknown, expired or reused. */
  async rotate(token: string): Promise<IssuedRefreshToken> {
    const stored = await this.tokens.findByHash(hashRefreshToken(token));
    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenError();
    }
    if (stored.usedAt) return this.rejectReuse(stored);

    // The successor is stored before the old token is claimed. When two requests
    // race with one token, the loser revokes the family after the winner's
    // successor exists, so the race never leaves a live session behind.
    const successor = await this.issueInFamily(stored.userId, stored.familyId);
    const claimed = await this.tokens.markUsed(stored.id, new Date());
    if (!claimed) return this.rejectReuse(stored);
    return successor;
  }

  /** Ends the session the token belongs to. Unknown tokens are ignored, so sign-out is idempotent. */
  async revoke(token: string): Promise<void> {
    const stored = await this.tokens.findByHash(hashRefreshToken(token));
    if (stored) await this.tokens.deleteFamily(stored.familyId);
  }

  private async issueInFamily(userId: string, familyId: string): Promise<IssuedRefreshToken> {
    const token = generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.tokens.create({ familyId, userId, tokenHash: hashRefreshToken(token), expiresAt });
    return { token, userId, expiresAt };
  }

  /** A retired token came back, so it was stolen or replayed: the whole session ends. */
  private async rejectReuse({ familyId, userId }: StoredRefreshToken): Promise<never> {
    await this.tokens.deleteFamily(familyId);
    this.logger.warn({ familyId, userId }, 'Refresh token reuse detected; session revoked');
    throw new InvalidRefreshTokenError();
  }
}
