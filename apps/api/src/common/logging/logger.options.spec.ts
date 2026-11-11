import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import { createTestConfig } from '../../../test/support/test-config.js';
import { createLoggerOptions } from './logger.options.js';

const pinoHttpFor = (NODE_ENV: 'development' | 'production') =>
  createLoggerOptions(createTestConfig({ NODE_ENV })).pinoHttp as Options;

describe('createLoggerOptions', () => {
  it('logs who called what, but no headers, so tokens and cookies never reach the logs', () => {
    const { serializers } = pinoHttpFor('production');
    const request = {
      id: 'req-1',
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      headers: { authorization: 'Bearer secret', cookie: 'refresh_token=secret' },
      // Express' req.ip, which honours TRUST_PROXY.
      raw: { ip: '203.0.113.7' },
    };
    const response = { statusCode: 200, headers: { 'set-cookie': 'refresh_token=secret' } };

    expect(serializers?.req?.(request)).toEqual({
      id: 'req-1',
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      ip: '203.0.113.7',
    });
    expect(serializers?.res?.(response)).toEqual({ statusCode: 200 });
  });

  it.each([
    { statusCode: 200, level: 'info' },
    { statusCode: 401, level: 'warn' },
    { statusCode: 503, level: 'error' },
  ])('logs a $statusCode response at $level', ({ statusCode, level }) => {
    const { customLogLevel } = pinoHttpFor('production');

    expect(customLogLevel?.({} as IncomingMessage, { statusCode } as ServerResponse)).toBe(level);
  });

  it('logs a response that failed while streaming as an error', () => {
    const { customLogLevel } = pinoHttpFor('production');
    const response = { statusCode: 200 } as ServerResponse;

    expect(customLogLevel?.({} as IncomingMessage, response, new Error('aborted'))).toBe('error');
  });

  it('leaves health checks out of the request log', () => {
    const { autoLogging } = pinoHttpFor('production');
    const ignore = typeof autoLogging === 'object' ? autoLogging.ignore : undefined;

    expect(ignore?.({ url: '/api/health' } as IncomingMessage)).toBe(true);
    expect(ignore?.({ url: '/api/v1/users/me' } as IncomingMessage)).toBe(false);
  });

  it('writes readable lines in development and JSON everywhere else', () => {
    expect(pinoHttpFor('development').transport).toMatchObject({ target: 'pino-pretty' });
    expect(pinoHttpFor('production').transport).toBeUndefined();
  });
});
