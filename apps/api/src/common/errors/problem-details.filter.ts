import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ERROR_CODES,
  type ErrorCode,
  type FieldError,
  type ProblemDetails,
} from '@nest-react-auth/contracts';
import { AppError, RequestValidationError } from './app-error.js';

const STATUS_BY_CODE: Record<ErrorCode, HttpStatus> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  MALFORMED_REQUEST: HttpStatus.BAD_REQUEST,
  EMAIL_ALREADY_REGISTERED: HttpStatus.CONFLICT,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  PAYLOAD_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Codes for the HTTP exceptions Nest and its modules throw (unknown route, rate limit, CSRF...). */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ERROR_CODES.PAYLOAD_TOO_LARGE,
  // The JSON parser's answer to a charset other than UTF-8, or an unknown Content-Encoding.
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
  [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMITED,
};

const FRIENDLY_DETAIL: Partial<Record<ErrorCode, string>> = {
  RATE_LIMITED: 'Too many requests. Please wait a minute and try again.',
  PAYLOAD_TOO_LARGE: 'The request body is too large.',
  UNSUPPORTED_MEDIA_TYPE: 'The request body must be JSON encoded as UTF-8.',
};

const INVALID_JSON_DETAIL = 'The request body is not valid JSON.';
const UNAVAILABLE_DETAIL = 'The service is temporarily unavailable.';
const INTERNAL_ERROR_DETAIL = 'Something went wrong on our side. Please try again.';

interface Problem {
  status: number;
  code: ErrorCode;
  detail: string;
  errors?: FieldError[];
}

/** pino-http sets `log` on every request it sees. Express' `ip` honours TRUST_PROXY. */
interface IncomingRequest {
  id?: unknown;
  log?: unknown;
  ip?: string;
}

/**
 * Turns every exception into an RFC 9457 problem+json response with a stable
 * `code`. Expected errors keep their message; anything unexpected becomes a
 * generic 500 and is logged with its stack, so internals never reach clients.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest<IncomingRequest>();
    const response = context.getResponse<unknown>();

    const problem = toProblem(exception);
    const requestId = typeof request.id === 'string' ? request.id : undefined;
    const instance = httpAdapter.getRequestUrl(request);

    if (problem.status >= 500) {
      this.logger.error({ err: exception, requestId }, 'Request failed with an unexpected error');
    } else if (request.log === undefined) {
      // Rejected before the request logger ran (a body that is not valid JSON, a
      // cross-site write), so this is the only record of the request.
      const method = httpAdapter.getRequestMethod(request);
      this.logger.warn(
        {
          requestId,
          method,
          url: instance,
          ip: request.ip,
          status: problem.status,
          code: problem.code,
        },
        'Request rejected before routing',
      );
    }

    const body: ProblemDetails = {
      type: 'about:blank',
      title: STATUS_CODES[problem.status] ?? 'Error',
      status: problem.status,
      detail: problem.detail,
      instance,
      code: problem.code,
      ...(requestId !== undefined && { requestId }),
      ...(problem.errors && { errors: problem.errors }),
    };

    httpAdapter.setHeader(response, 'Content-Type', 'application/problem+json');
    // RFC 9110 asks every 401 to name the scheme that would work. Bearer never makes a
    // browser show its own sign-in dialog, as Basic would.
    if (problem.status === HttpStatus.UNAUTHORIZED) {
      httpAdapter.setHeader(response, 'WWW-Authenticate', 'Bearer');
    }
    httpAdapter.reply(response, body, problem.status);
  }
}

export function toProblem(exception: unknown): Problem {
  if (exception instanceof AppError) {
    return {
      status: STATUS_BY_CODE[exception.code],
      code: exception.code,
      detail: exception.message,
      ...(exception instanceof RequestValidationError && { errors: exception.errors }),
    };
  }

  // Nest also maps Express and body-parser errors (invalid JSON, oversized body) to HttpExceptions.
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    if (status < 500) {
      const code = CODE_BY_STATUS[status] ?? ERROR_CODES.MALFORMED_REQUEST;
      return { status, code, detail: FRIENDLY_DETAIL[code] ?? clientMessageOf(exception) };
    }
    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      return { status, code: ERROR_CODES.SERVICE_UNAVAILABLE, detail: UNAVAILABLE_DETAIL };
    }
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    detail: INTERNAL_ERROR_DETAIL,
  };
}

function clientMessageOf(exception: HttpException): string {
  // Nest wraps the JSON parser's SyntaxError, whose message quotes the raw body.
  return exception.cause instanceof SyntaxError ? INVALID_JSON_DETAIL : exception.message;
}
