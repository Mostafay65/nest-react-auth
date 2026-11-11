import { applyDecorators } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { authSessionSchema } from '@nest-react-auth/contracts';
import {
  ApiProblemResponse,
  ApiRateLimitResponse,
  ApiWriteProblemResponses,
  REFRESH_TOKEN_AUTH,
  refreshCookieHeader,
} from '../common/swagger/swagger.js';

const INVALID_BODY = 'The body is not valid JSON, or a field is invalid: `errors` lists each one';

/** A session in the body, and the refresh token in a cookie. */
const sessionResponse = (description: string) => ({
  description,
  standardSchema: authSessionSchema,
  headers: refreshCookieHeader('The refresh token, valid for 7 days.'),
});

export const ApiSignUp = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create an account and start a session' }),
    ApiCreatedResponse(sessionResponse('Account created and signed in')),
    ApiProblemResponse(400, INVALID_BODY),
    ApiProblemResponse(409, 'The email is already registered'),
    ApiRateLimitResponse('credentials'),
    ApiWriteProblemResponses(),
  );

export const ApiSignIn = () =>
  applyDecorators(
    ApiOperation({ summary: 'Sign in with email and password' }),
    ApiOkResponse(sessionResponse('Signed in')),
    ApiProblemResponse(400, INVALID_BODY),
    ApiProblemResponse(401, 'The email or password is incorrect (same answer for both)'),
    ApiRateLimitResponse('credentials'),
    ApiWriteProblemResponses(),
  );

export const ApiRefresh = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Exchange the refresh token cookie for a new access token',
      description:
        'The refresh token rotates on every call. Presenting a token that was already used ends the whole session.',
    }),
    ApiCookieAuth(REFRESH_TOKEN_AUTH),
    ApiOkResponse(sessionResponse('A new access token, and the next refresh token')),
    ApiProblemResponse(401, 'The cookie is missing, unknown, expired or already used'),
    ApiRateLimitResponse(),
    ApiWriteProblemResponses(),
  );

export const ApiSignOut = () =>
  applyDecorators(
    ApiOperation({ summary: 'End the session and clear the refresh token cookie' }),
    ApiCookieAuth(REFRESH_TOKEN_AUTH),
    ApiNoContentResponse({
      description: 'Signed out. Safe to call more than once.',
      headers: refreshCookieHeader('Clears the refresh token cookie.'),
    }),
    ApiRateLimitResponse(),
    ApiWriteProblemResponses(),
  );
