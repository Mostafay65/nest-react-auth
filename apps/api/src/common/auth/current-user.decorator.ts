import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** The caller, as proven by a valid access token. */
export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

/** Injects the authenticated user into a protected route handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) {
      throw new Error('@CurrentUser() needs a protected route; this one is marked @Public()');
    }
    return user;
  },
);
