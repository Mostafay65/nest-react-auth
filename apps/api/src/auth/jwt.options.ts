import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { Env } from '../config/env.js';

export const JWT_ISSUER = 'nest-react-auth-api';
export const JWT_AUDIENCE = 'nest-react-auth-web';

/**
 * HS256 only, with the issuer and audience checked on every token, so a token
 * signed with `alg: none` or meant for another service is rejected.
 */
export const createJwtOptions = (config: ConfigService<Env, true>): JwtModuleOptions => ({
  secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
  signOptions: { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
});
