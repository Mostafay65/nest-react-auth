/**
 * The password policy from the spec: at least 8 characters, with a letter,
 * a number and a special character. The API validates against it and the web
 * client renders it as a live checklist, so both always show the same rules.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Passwords are normalised to NFKC before the rules run, as NIST SP 800-63B
 * asks, so a composed "é" and an "e" plus an accent are the same password.
 * The rules must judge the normalised string, or the checklist and the API
 * would disagree about the same input.
 */
export const normalizePassword = (password: string): string => password.normalize('NFKC');

const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;
const SPECIAL = /[\p{P}\p{S}]/u;

export type PasswordRuleId = 'length' | 'letter' | 'number' | 'special';

export interface PasswordRule {
  readonly id: PasswordRuleId;
  /** Short wording for the checklist next to the password field. */
  readonly label: string;
  /** Full sentence returned when the rule fails. */
  readonly message: string;
  readonly test: (password: string) => boolean;
}

/**
 * Counts Unicode code points, as NIST SP 800-63B asks for password length,
 * so an emoji counts once rather than as two UTF-16 units.
 */
const codePointCount = (value: string): number => Array.from(value).length;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
    test: (password) => codePointCount(password) >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'letter',
    label: 'One letter',
    message: 'Password must contain at least one letter',
    test: (password) => LETTER.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    message: 'Password must contain at least one number',
    test: (password) => DIGIT.test(password),
  },
  {
    id: 'special',
    label: 'One special character',
    message: 'Password must contain at least one special character, such as ! ? # or @',
    test: (password) => SPECIAL.test(password),
  },
];
