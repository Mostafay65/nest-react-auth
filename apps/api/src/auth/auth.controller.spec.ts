import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE } from '../common/auth/public.decorator.js';
import { AuthController } from './auth.controller.js';

describe('AuthController', () => {
  it('opens each route on its own, so a route added later needs an access token', () => {
    const reflector = new Reflector();

    expect(reflector.get(IS_PUBLIC_ROUTE, AuthController)).toBeUndefined();
    for (const route of ['signUp', 'signIn', 'refresh', 'signOut'] as const) {
      expect(reflector.get(IS_PUBLIC_ROUTE, AuthController.prototype[route]), route).toBe(true);
    }
  });
});
