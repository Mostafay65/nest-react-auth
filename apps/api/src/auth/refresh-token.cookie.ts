import { type CookieSerializeOptions, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_PATH } from '../common/http/api.constants.js';
import type { Env } from '../config/env.js';
import type { IssuedRefreshToken } from './refresh-tokens/refresh-token.js';

/**
 * Writes the refresh token where scripts can't reach it: httpOnly, SameSite
 * Strict, Secure (outside local HTTP), and only sent to the auth routes.
 */
@Injectable()
export class RefreshTokenCookie {
  private readonly attributes: CookieSerializeOptions;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    config: ConfigService<Env, true>,
  ) {
    this.attributes = {
      httpOnly: true,
      secure: config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'strict',
      path: REFRESH_TOKEN_COOKIE_PATH,
    };
  }

  write(response: unknown, refreshToken: IssuedRefreshToken): void {
    // Nest's cookie API takes Max-Age in seconds (Express' res.cookie takes milliseconds).
    const maxAge = Math.ceil((refreshToken.expiresAt.getTime() - Date.now()) / 1_000);
    this.adapterHost.httpAdapter.setCookie(response, REFRESH_TOKEN_COOKIE, refreshToken.token, {
      ...this.attributes,
      maxAge,
    });
  }

  clear(response: unknown): void {
    this.adapterHost.httpAdapter.clearCookie(response, REFRESH_TOKEN_COOKIE, this.attributes);
  }
}
