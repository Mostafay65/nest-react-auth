import { type NestApplicationOptions, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { API_PREFIX, API_VERSION } from './common/http/api.constants.js';
import { assignRequestId, REQUEST_ID_HEADER } from './common/http/request-id.middleware.js';
import { setupSwagger } from './common/swagger/swagger.js';
import type { Env } from './config/env.js';

/**
 * Builds the application exactly as it ships. main.ts and the e2e tests both
 * start here, so the tests exercise the real HTTP pipeline.
 */
export async function createApp(
  options: Pick<NestApplicationOptions, 'abortOnError'> = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...options,
    bufferLogs: true,
    // Registered below instead: after the request ID, and for JSON only.
    bodyParser: false,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));

  // Middleware runs in the order it is registered.
  app.use(assignRequestId);
  app.useSecurityHeaders({
    // The only HTML served here is Swagger UI, which loads same-origin assets only. Over
    // plain-HTTP local runs this directive would make browsers fetch them over HTTPS.
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
  });
  // Rejects cross-site writes (Sec-Fetch-Site, then Origin), on top of the SameSite=Strict
  // refresh cookie. Origins allowed by CORS are trusted here too.
  app.enableCsrfProtection({ trustedOrigins: corsOrigins });
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true, exposedHeaders: [REQUEST_ID_HEADER] });
  }
  app.useBodyParser('json', { limit: '10kb' });

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION });
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    setupSwagger(app);
  }
  return app;
}
