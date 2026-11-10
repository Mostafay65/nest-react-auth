import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/shared/http/api-error';

export const FORM_MESSAGES = {
  network: 'We could not reach the server. Check your connection and try again.',
  rateLimited: 'Too many attempts from this network. Please wait a minute, then try again.',
  unexpected: 'Something went wrong on our side. Please try again in a moment.',
} as const;

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
  if (!(error instanceof ApiError)) return { message: FORM_MESSAGES.unexpected };

  switch (error.code) {
    case 'EMAIL_ALREADY_REGISTERED': {
      const email = fields.find((field) => field === 'email');
      if (!email) return { message: error.message };
      setError(email, { type: 'server', message: error.message });
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
      return first ? { field: first } : { message: error.message };
    }
    case 'INVALID_CREDENTIALS':
      return { message: error.message };
    case 'RATE_LIMITED':
      return { message: FORM_MESSAGES.rateLimited };
    case 'NETWORK_ERROR':
      return { message: FORM_MESSAGES.network };
    default:
      return { message: FORM_MESSAGES.unexpected };
  }
}
