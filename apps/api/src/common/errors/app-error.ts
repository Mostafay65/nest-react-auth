import { ERROR_CODES, type ErrorCode, type FieldError } from '@nest-react-auth/contracts';

/**
 * Base class for expected failures. Services throw these instead of HTTP
 * exceptions, so they stay transport-agnostic; ProblemDetailsFilter maps the
 * `code` to an HTTP status.
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  readonly code = ERROR_CODES.UNAUTHORIZED;

  constructor(message = 'Authentication is required') {
    super(message);
  }
}

export class RequestValidationError extends AppError {
  readonly code = ERROR_CODES.VALIDATION_FAILED;

  constructor(readonly errors: FieldError[]) {
    super('The request is invalid. See `errors` for each field.');
  }
}
