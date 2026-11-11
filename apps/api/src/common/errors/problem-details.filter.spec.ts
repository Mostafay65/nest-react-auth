import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { InvalidCredentialsError, InvalidRefreshTokenError } from '../../auth/auth.errors.js';
import { EmailAlreadyRegisteredError } from '../../users/users.errors.js';
import { RequestValidationError, UnauthorizedError } from './app-error.js';
import { ProblemDetailsFilter, toProblem } from './problem-details.filter.js';

const INTERNAL_ERROR = {
  status: 500,
  code: 'INTERNAL_ERROR',
  detail: 'Something went wrong on our side. Please try again.',
};

describe('toProblem', () => {
  it('maps a domain error to its status and keeps its message', () => {
    expect(toProblem(new EmailAlreadyRegisteredError())).toEqual({
      status: 409,
      code: 'EMAIL_ALREADY_REGISTERED',
      detail: 'An account with this email already exists.',
    });
    expect(toProblem(new InvalidCredentialsError())).toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('includes the field errors of a validation failure', () => {
    const errors = [{ field: 'email', message: 'Enter a valid email address' }];

    expect(toProblem(new RequestValidationError(errors))).toEqual({
      status: 400,
      code: 'VALIDATION_FAILED',
      detail: 'The request is invalid. See `errors` for each field.',
      errors,
    });
  });

  it('gives the HTTP exceptions Nest throws a stable code', () => {
    expect(toProblem(new NotFoundException('Cannot GET /api/v1/nope'))).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Cannot GET /api/v1/nope',
    });
    expect(toProblem(new ThrottlerException())).toEqual({
      status: 429,
      code: 'RATE_LIMITED',
      detail: 'Too many requests. Please wait a minute and try again.',
    });
    expect(toProblem(new HttpException('request entity too large', 413))).toEqual({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      detail: 'The request body is too large.',
    });
    expect(toProblem(new HttpException('unsupported charset "LATIN1"', 415))).toEqual({
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      detail: 'The request body must be JSON encoded as UTF-8.',
    });
  });

  it('describes invalid JSON without echoing the raw body', () => {
    const parseError = new SyntaxError('Unexpected token } in JSON at position 12');

    expect(toProblem(new BadRequestException(parseError.message, { cause: parseError }))).toEqual({
      status: 400,
      code: 'MALFORMED_REQUEST',
      detail: 'The request body is not valid JSON.',
    });
  });

  it('reports a failed health check as temporarily unavailable', () => {
    expect(toProblem(new ServiceUnavailableException({ mongodb: { status: 'down' } }))).toEqual({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      detail: 'The service is temporarily unavailable.',
    });
  });

  it.each([
    ['an unexpected error', new Error('connect ECONNREFUSED 10.0.0.12:27017')],
    ['a 5xx HTTP exception', new InternalServerErrorException('stack details')],
    [
      'an error that only claims an HTTP status',
      Object.assign(new Error('upstream'), { status: 404 }),
    ],
    ['a thrown string', 'boom'],
  ])('hides the details of %s behind a generic 500', (_label, exception) => {
    expect(toProblem(exception)).toEqual(INTERNAL_ERROR);
  });
});

describe('ProblemDetailsFilter', () => {
  const adapter = {
    getRequestUrl: (request: { url: string }) => request.url,
    getRequestMethod: (request: { method: string }) => request.method,
    setHeader: vi.fn(),
    reply: vi.fn(),
  };
  const filter = new ProblemDetailsFilter({ httpAdapter: adapter } as unknown as HttpAdapterHost);
  const response = {};

  const hostFor = (request: object): ArgumentsHost =>
    ({
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    }) as unknown as ArgumentsHost;

  /** A request the request logger (pino-http) has seen: it sets `log`. */
  const loggedRequest = { id: 'req-1', method: 'GET', url: '/api/v1/users/me', log: {} };

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('answers with problem+json that carries the request ID', () => {
    filter.catch(new EmailAlreadyRegisteredError(), hostFor(loggedRequest));

    expect(adapter.setHeader).toHaveBeenCalledWith(
      response,
      'Content-Type',
      'application/problem+json',
    );
    expect(adapter.reply).toHaveBeenCalledWith(
      response,
      {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'An account with this email already exists.',
        instance: '/api/v1/users/me',
        code: 'EMAIL_ALREADY_REGISTERED',
        requestId: 'req-1',
      },
      HttpStatus.CONFLICT,
    );
  });

  it.each([
    ['a missing access token', new UnauthorizedError()],
    ['a wrong password', new InvalidCredentialsError()],
    ['a dead refresh token', new InvalidRefreshTokenError()],
  ])('names the Bearer scheme on every 401: %s', (_case, error) => {
    filter.catch(error, hostFor(loggedRequest));

    expect(adapter.setHeader).toHaveBeenCalledWith(response, 'WWW-Authenticate', 'Bearer');
  });

  it('sends no authentication challenge with other errors', () => {
    filter.catch(new EmailAlreadyRegisteredError(), hostFor(loggedRequest));

    expect(adapter.setHeader).not.toHaveBeenCalledWith(
      response,
      'WWW-Authenticate',
      expect.anything(),
    );
  });

  it('logs unexpected errors with their stack', () => {
    const logError = vi.spyOn(Logger.prototype, 'error');
    const failure = new Error('connect ECONNREFUSED');

    filter.catch(failure, hostFor(loggedRequest));

    expect(logError).toHaveBeenCalledWith(
      { err: failure, requestId: 'req-1' },
      'Request failed with an unexpected error',
    );
  });

  it('logs a request rejected before the request logger saw it', () => {
    const logWarn = vi.spyOn(Logger.prototype, 'warn');
    const rejectedEarly = {
      id: 'req-2',
      method: 'POST',
      url: '/api/v1/auth/sign-in',
      ip: '203.0.113.7',
    };

    filter.catch(new HttpException('request entity too large', 413), hostFor(rejectedEarly));

    expect(logWarn).toHaveBeenCalledWith(
      {
        requestId: 'req-2',
        method: 'POST',
        url: '/api/v1/auth/sign-in',
        ip: '203.0.113.7',
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
      },
      'Request rejected before routing',
    );
  });

  it('does not log expected errors twice', () => {
    const logWarn = vi.spyOn(Logger.prototype, 'warn');

    filter.catch(new InvalidCredentialsError(), hostFor(loggedRequest));

    expect(logWarn).not.toHaveBeenCalled();
  });
});
