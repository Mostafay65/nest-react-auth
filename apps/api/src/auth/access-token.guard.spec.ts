import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createTestConfig } from '../../test/support/test-config.js';
import type { AuthenticatedRequest } from '../common/auth/current-user.decorator.js';
import { Public } from '../common/auth/public.decorator.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AccessTokenService } from './access-token.service.js';
import { createJwtOptions } from './jwt.options.js';

const USER_ID = '665f1c2e8b3a4d0012345678';

class ProtectedController {
  profile(): void {}
}

@Public()
class PublicController {
  signIn(): void {}
}

class MixedController {
  @Public()
  health(): void {}
}

/** The parts of an ExecutionContext the guard reads, for one route handler. */
function contextFor(
  request: AuthenticatedRequest,
  controller: new () => object = ProtectedController,
  handler = 'profile',
): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => (controller.prototype as Record<string, unknown>)[handler],
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  const config = createTestConfig();
  const accessTokens = new AccessTokenService(new JwtService(createJwtOptions(config)), config);
  const guard = new AccessTokenGuard(new Reflector(), accessTokens);

  it('lets a valid bearer token through and attaches the user to the request', async () => {
    const { token } = await accessTokens.issue(USER_ID);
    const request: AuthenticatedRequest = { headers: { authorization: `Bearer ${token}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: USER_ID });
  });

  it('accepts the scheme in any letter case, as RFC 9110 allows', async () => {
    const { token } = await accessTokens.issue(USER_ID);
    const request: AuthenticatedRequest = { headers: { authorization: `bearer ${token}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });

  it('rejects a request without an Authorization header', async () => {
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it.each(['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'Bearer one two', 'just-a-token'])(
    'rejects the malformed header %j',
    async (authorization) => {
      const request: AuthenticatedRequest = { headers: { authorization } };

      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    },
  );

  it('rejects a token that does not verify', async () => {
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer not.a.jwt' } };

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedError);
    expect(request.user).toBeUndefined();
  });

  it('skips the check for a controller marked @Public()', async () => {
    const context = contextFor({ headers: {} }, PublicController, 'signIn');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('skips the check for a single route marked @Public()', async () => {
    const context = contextFor({ headers: {} }, MixedController, 'health');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
