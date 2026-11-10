import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator.js';
import { IS_PUBLIC_ROUTE } from '../common/auth/public.decorator.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
import { AccessTokenService } from './access-token.service.js';

/** Registered globally: every route needs a valid access token unless it is marked @Public(). */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedError('Send an access token as `Authorization: Bearer <token>`.');
    }

    request.user = await this.accessTokens.verify(token);
    return true;
  }
}

function readBearerToken(header: string | undefined): string | undefined {
  const [scheme, token, ...rest] = header?.trim().split(/\s+/) ?? [];
  return scheme?.toLowerCase() === 'bearer' && token && rest.length === 0 ? token : undefined;
}
