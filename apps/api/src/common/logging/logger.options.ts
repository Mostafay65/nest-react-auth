import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Params } from 'nestjs-pino';
import type { SerializedRequest, SerializedResponse } from 'pino';
import type { Env } from '../../config/env.js';
import { HEALTH_PATH } from '../http/api.constants.js';

/**
 * Structured request logs: JSON in production, one readable line per request
 * in development. Each line carries the request ID set by `assignRequestId`
 * (pino-http keeps an existing `req.id`). Headers are never logged, so neither
 * are tokens or cookies.
 */
export function createLoggerOptions(config: ConfigService<Env, true>): Params {
  const isDevelopment = config.get('NODE_ENV', { infer: true }) === 'development';

  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL', { infer: true }),
      transport: isDevelopment
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
      serializers: {
        req: (request: SerializedRequest) => ({
          id: request.id,
          method: request.method,
          url: request.url,
          // Express' req.ip honours TRUST_PROXY; the socket address would be the proxy's.
          ip: (request.raw as Request).ip,
        }),
        res: (response: SerializedResponse) => ({ statusCode: response.statusCode }),
      },
      customLogLevel: (_request, response, error) => {
        if (error || response.statusCode >= 500) return 'error';
        if (response.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: { ignore: (request) => request.url === HEALTH_PATH },
    },
  };
}
