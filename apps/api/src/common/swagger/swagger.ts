import { applyDecorators, type INestApplication } from '@nestjs/common';
import { ApiResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { problemDetailsSchema } from '@nest-react-auth/contracts';
import { z } from 'zod';
import { DOCS_PATH, REFRESH_TOKEN_COOKIE } from '../http/api.constants.js';

export const ACCESS_TOKEN_AUTH = 'access-token';
export const REFRESH_TOKEN_AUTH = 'refresh-token';

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
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, ACCESS_TOKEN_AUTH)
    .addCookieAuth(REFRESH_TOKEN_COOKIE, { type: 'apiKey', in: 'cookie' }, REFRESH_TOKEN_AUTH)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: `${DOCS_PATH}/openapi.json`,
    customSiteTitle: 'nest-react-auth API',
  });
}

const problemJsonSchema = z.toJSONSchema(problemDetailsSchema, { target: 'openapi-3.0' });

/** Documents an error response as RFC 9457 problem+json. */
export const ApiProblemResponse = (status: number, description: string) =>
  applyDecorators(
    ApiResponse({
      status,
      description,
      content: { 'application/problem+json': { schema: problemJsonSchema as object } },
    }),
  );
