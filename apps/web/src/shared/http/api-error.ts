import type { ErrorCode, FieldError } from '@nest-react-auth/contracts';

/** The API's own codes, plus two for answers that never arrived or could not be read. */
export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE';

interface ApiErrorInit {
  code: ApiErrorCode;
  /** The HTTP status, or 0 when no response arrived. */
  status: number;
  message: string;
  fieldErrors?: readonly FieldError[];
}

/** Every failed API call ends up as one of these, so callers handle a single error type. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors: readonly FieldError[];

  constructor({ code, status, message, fieldErrors = [] }: ApiErrorInit) {
    super(message);
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export const isUnauthorized = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 401;
