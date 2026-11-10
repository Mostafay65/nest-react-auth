import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_RULES } from './password-policy.js';
import { userProfileSchema } from './users.js';

export const EMAIL_MAX_LENGTH = 254;
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 50;

/** A string field with "is required" for a missing or empty value, and a type error for anything else. */
const requiredString = (label: string) =>
  z.string({
    error: (issue) =>
      issue.input === undefined ? `${label} is required` : `${label} must be a string`,
  });

const notEmpty = (label: string) => ({ error: `${label} is required`, abort: true });

/** For a body that is missing or is not an object; other issues keep Zod's message. */
const requestBody = {
  error: (issue: z.core.$ZodRawIssue) =>
    issue.code === 'invalid_type' ? 'The request body must be a JSON object' : undefined,
};

/** Trimmed and lower-cased before it is checked, so `Ada@Example.com ` and `ada@example.com` are one account. */
export const emailSchema = requiredString('Email')
  .trim()
  .toLowerCase()
  .min(1, notEmpty('Email'))
  .max(EMAIL_MAX_LENGTH, { error: `Email must be at most ${EMAIL_MAX_LENGTH} characters long` })
  .pipe(z.email({ error: 'Enter a valid email address' }))
  .meta({
    description: 'Trimmed and lower-cased before it is checked.',
    examples: ['ada@example.com'],
  });

export const nameSchema = requiredString('Name')
  .trim()
  .min(1, notEmpty('Name'))
  .min(NAME_MIN_LENGTH, { error: `Name must be at least ${NAME_MIN_LENGTH} characters long` })
  .max(NAME_MAX_LENGTH, { error: `Name must be at most ${NAME_MAX_LENGTH} characters long` })
  .meta({ examples: ['Ada Lovelace'] });

const passwordMaxLength = {
  error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters long`,
};

/** Reports every failed rule at once, so the client can show them all together. */
export const passwordSchema = PASSWORD_RULES.reduce(
  (schema, rule) => schema.refine(rule.test, { error: rule.message }),
  requiredString('Password')
    .min(1, notEmpty('Password'))
    .max(PASSWORD_MAX_LENGTH, passwordMaxLength),
).meta({
  description: `${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters, with at least one letter, one number and one special character.`,
  examples: ['Analytical1!'],
});

export const signUpSchema = z.strictObject(
  { email: emailSchema, name: nameSchema, password: passwordSchema },
  requestBody,
);

/**
 * Sign-in only checks that a password was sent. Applying the sign-up policy
 * here would lock out accounts created under an older policy.
 */
export const signInSchema = z.strictObject(
  {
    email: emailSchema,
    password: requiredString('Password')
      .min(1, notEmpty('Password'))
      .max(PASSWORD_MAX_LENGTH, passwordMaxLength)
      .meta({ examples: ['Analytical1!'] }),
  },
  requestBody,
);

/** Returned by sign-up, sign-in and refresh. The refresh token travels in an httpOnly cookie instead. */
export const authSessionSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  /** Lifetime of the access token, in seconds. */
  expiresIn: z.number().int().positive(),
  user: userProfileSchema,
});

/** What the client sends, before trimming and lower-casing. */
export type SignUpInput = z.input<typeof signUpSchema>;
/** What the server works with, after trimming and lower-casing. */
export type SignUpData = z.output<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type SignInData = z.output<typeof signInSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
