import { applyDecorators, type INestApplication } from '@nestjs/common';
import { ApiResponse, DocumentBuilder, type HeadersObject, SwaggerModule } from '@nestjs/swagger';
import { problemDetailsSchema } from '@nest-react-auth/contracts';
import { z } from 'zod';
import {
  DOCS_PATH,
  RATE_LIMITS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from '../http/api.constants.js';
import { REQUEST_ID_HEADER } from '../http/request-id.middleware.js';

export const ACCESS_TOKEN_AUTH = 'access-token';
export const REFRESH_TOKEN_AUTH = 'refresh-token';

/** Every error response points at this one schema instead of repeating it. */
const PROBLEM_SCHEMA = 'ProblemDetails';

/** Serves Swagger UI at /api/docs and the OpenAPI document at /api/docs/openapi.json. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('nest-react-auth API')
    .setDescription(
      [
        'Sign-up, sign-in and session management.',
        '',
        '- **Access token:** a short-lived JWT, returned in the response body. Send it as `Authorization: Bearer <token>`.',
        '- **Refresh token:** an httpOnly cookie scoped to `/api/v1/auth`. It rotates on every refresh, and reusing an old one ends the session.',
        '- **Errors:** every error is an RFC 9457 `application/problem+json` body with a stable `code`.',
        `- **Request IDs:** every response carries \`${REQUEST_ID_HEADER}\`, which error bodies repeat as \`requestId\`. Send your own (up to 128 letters, digits and \`_.:-\`) to follow a call through the logs.`,
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, ACCESS_TOKEN_AUTH)
    .addCookieAuth(REFRESH_TOKEN_COOKIE, { type: 'apiKey', in: 'cookie' }, REFRESH_TOKEN_AUTH)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      [PROBLEM_SCHEMA]: z.toJSONSchema(problemDetailsSchema, { target: 'openapi-3.0' }) as object,
    },
  };
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: `${DOCS_PATH}/openapi.json`,
    customSiteTitle: 'nest-react-auth API',
  });
}

/** Documents an error response as RFC 9457 problem+json. */
export const ApiProblemResponse = (
  status: number | 'default',
  description: string,
  headers?: HeadersObject,
) =>
  ApiResponse({
    status,
    description,
    ...(headers && { headers }),
    content: {
      'application/problem+json': { schema: { $ref: `#/components/schemas/${PROBLEM_SCHEMA}` } },
    },
  });

/** On a controller: whatever its routes don't list, such as a 500, is problem+json too. */
export const ApiOtherProblemsResponse = () =>
  ApiProblemResponse(
    'default',
    'Any other error, such as 500 `INTERNAL_ERROR`. The details go to the server log under `requestId`, never to the client.',
  );

/** The rate limit a route runs under, in the words the 429 answer needs. */
export const ApiRateLimitResponse = (limit: keyof typeof RATE_LIMITS = 'default') =>
  ApiProblemResponse(
    429,
    `More than ${RATE_LIMITS[limit].limit} requests a minute to this route from one IP address`,
    {
      'Retry-After': {
        description: 'Seconds until this route accepts requests again',
        schema: { type: 'integer' },
      },
    },
  );

/** The refresh token cookie that sign-up, sign-in and refresh set, and sign-out clears. */
export const refreshCookieHeader = (description: string): HeadersObject => ({
  'Set-Cookie': {
    description: `${description} Attributes: \`HttpOnly; SameSite=Strict; Path=${REFRESH_TOKEN_COOKIE_PATH}\`, plus \`Secure\` unless COOKIE_SECURE=false.`,
    schema: { type: 'string', example: `${REFRESH_TOKEN_COOKIE}=<token>` },
  },
});

/** What any write can be refused with before its handler runs: the cross-site check, then the JSON parser. */
export const ApiWriteProblemResponses = () =>
  applyDecorators(
    ApiProblemResponse(
      403,
      'Sent from another site. Writes must come from the same origin, or one in CORS_ORIGINS',
    ),
    ApiProblemResponse(413, 'The JSON body is larger than 10 kB'),
    ApiProblemResponse(
      415,
      'The JSON body declares a charset other than UTF-8, or an unknown Content-Encoding',
    ),
  );
