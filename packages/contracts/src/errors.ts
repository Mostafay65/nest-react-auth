import { z } from 'zod';

/** Stable, machine-readable error codes. Clients branch on these, never on message text. */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  MALFORMED_REQUEST: 'MALFORMED_REQUEST',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const fieldErrorSchema = z.object({
  /** Dot path of the invalid field, for example `password`. Absent for errors about the whole body. */
  field: z.string().optional(),
  message: z.string(),
});

/** RFC 9457 Problem Details, extended with `code`, `requestId` and field-level `errors`. */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  code: z.enum(ERROR_CODES),
  requestId: z.string().optional(),
  errors: z.array(fieldErrorSchema).optional(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
