import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, type ApiErrorCode } from '@/shared/http/api-error';

const UNEXPECTED = 'Something went wrong on our side. Please try again in a moment.';

/**
 * What a form says for each error code. The copy belongs to the client: the
 * server's `detail` is written for developers and may change, so it is never
 * shown. A new code fails the typecheck here until it has a message.
 */
export const FORM_MESSAGES: Record<ApiErrorCode, string> = {
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  // Only when the server names no field we show; field errors use the contract's own messages.
  VALIDATION_FAILED: 'Some of these details were not accepted. Check them and try again.',
  RATE_LIMITED: 'Too many attempts from this network. Please wait a minute, then try again.',
  NETWORK_ERROR: 'We could not reach the server. Check your connection and try again.',
  SERVICE_UNAVAILABLE: 'The service is unavailable right now. Please try again in a moment.',
  MALFORMED_REQUEST: UNEXPECTED,
  INVALID_REFRESH_TOKEN: UNEXPECTED,
  UNAUTHORIZED: UNEXPECTED,
  FORBIDDEN: UNEXPECTED,
  NOT_FOUND: UNEXPECTED,
  PAYLOAD_TOO_LARGE: UNEXPECTED,
  UNSUPPORTED_MEDIA_TYPE: UNEXPECTED,
  INTERNAL_ERROR: UNEXPECTED,
  UNEXPECTED_RESPONSE: UNEXPECTED,
};

/** Where a failed submission is shown: on one field, or above the button. */
export type FormFailure<T extends FieldValues> = { field: Path<T> } | { message: string };

/**
 * Puts a failed sign-in or sign-up where the user will look for it. Errors
 * about a field (an email already registered, a rule the server enforced) go
 * on that field; everything else becomes one calm message above the button.
 */
export function placeServerError<T extends FieldValues>(
  error: unknown,
  /** The form's fields in on-screen order. */
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): FormFailure<T> {
  if (!(error instanceof ApiError)) return { message: UNEXPECTED };
  const message = FORM_MESSAGES[error.code];

  switch (error.code) {
    case 'EMAIL_ALREADY_REGISTERED': {
      const email = fields.find((field) => field === 'email');
      if (!email) return { message };
      setError(email, { type: 'server', message });
      return { field: email };
    }
    case 'VALIDATION_FAILED': {
      // The server lists every failed rule; each field shows the first one, as the client does.
      const placed: Path<T>[] = [];
      for (const fieldError of error.fieldErrors) {
        const field = fields.find((name) => name === fieldError.field);
        if (!field || placed.includes(field)) continue;
        setError(field, { type: 'server', message: fieldError.message });
        placed.push(field);
      }
      // `fields` is in on-screen order, so focus lands on the topmost invalid field.
      const first = fields.find((field) => placed.includes(field));
      return first ? { field: first } : { message };
    }
    default:
      return { message };
  }
}
