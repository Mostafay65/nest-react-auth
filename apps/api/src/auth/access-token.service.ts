import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from '../common/auth/current-user.decorator.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
import type { Env } from '../config/env.js';

export interface IssuedAccessToken {
  token: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

/** Short-lived JWTs. The algorithm, issuer and audience are pinned by createJwtOptions. */
@Injectable()
export class AccessTokenService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  }

  async issue(userId: string): Promise<IssuedAccessToken> {
    // A unique jti, so two tokens issued in the same second still differ and logs can tell them apart.
    const token = await this.jwt.signAsync(
      { sub: userId },
      { expiresIn: this.ttlSeconds, jwtid: randomUUID() },
    );
    return { token, expiresIn: this.ttlSeconds };
  }

  /** @throws UnauthorizedError when the token is malformed, tampered with or expired. */
  async verify(token: string): Promise<AuthenticatedUser> {
    let payload: { sub?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedError('The access token is invalid or has expired.');
    }
    if (typeof payload.sub !== 'string') {
      throw new UnauthorizedError('The access token is invalid or has expired.');
    }
    return { id: payload.sub };
  }
}
