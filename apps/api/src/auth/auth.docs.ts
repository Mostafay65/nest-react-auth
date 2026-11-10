import { applyDecorators } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { authSessionSchema } from '@nest-react-auth/contracts';
import { ApiProblemResponse, REFRESH_TOKEN_AUTH } from '../common/swagger/swagger.js';

const SETS_COOKIE =
  'Also sets the `refresh_token` cookie (httpOnly, SameSite=Strict, Path=/api/v1/auth).';

export const ApiSignUp = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create an account and start a session' }),
    ApiCreatedResponse({ description: SETS_COOKIE, standardSchema: authSessionSchema }),
    ApiProblemResponse(400, 'Validation failed; `errors` lists every invalid field'),
    ApiProblemResponse(409, 'The email is already registered'),
    ApiProblemResponse(429, 'Too many attempts from this IP address'),
  );

export const ApiSignIn = () =>
  applyDecorators(
    ApiOperation({ summary: 'Sign in with email and password' }),
    ApiOkResponse({ description: SETS_COOKIE, standardSchema: authSessionSchema }),
    ApiProblemResponse(400, 'Validation failed'),
    ApiProblemResponse(401, 'The email or password is incorrect (same answer for both)'),
    ApiProblemResponse(429, 'Too many attempts from this IP address'),
  );

export const ApiRefresh = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Exchange the refresh token cookie for a new access token',
      description:
        'The refresh token rotates on every call. Presenting a token that was already used ends the whole session.',
    }),
    ApiCookieAuth(REFRESH_TOKEN_AUTH),
    ApiOkResponse({ description: SETS_COOKIE, standardSchema: authSessionSchema }),
    ApiProblemResponse(401, 'The cookie is missing, unknown, expired or already used'),
  );

export const ApiSignOut = () =>
  applyDecorators(
    ApiOperation({ summary: 'End the session and clear the refresh token cookie' }),
    ApiCookieAuth(REFRESH_TOKEN_AUTH),
    ApiNoContentResponse({ description: 'Signed out. Safe to call more than once.' }),
  );
