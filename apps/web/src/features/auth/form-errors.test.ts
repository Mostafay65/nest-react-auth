import { ApiError, type ApiErrorCode } from '@/shared/http/api-error';
import { FORM_MESSAGES, placeServerError } from './form-errors';

const FIELDS = ['name', 'email', 'password'] as const;
type Fields = { name: string; email: string; password: string };

/** A message written for developers, which the user must never see. */
const SERVER_DETAIL = 'E11000 duplicate key error collection: users index: email_1';

const failure = (code: ApiErrorCode, status: number, fieldErrors: ApiError['fieldErrors'] = []) =>
  new ApiError({ code, status, message: SERVER_DETAIL, fieldErrors });

function place(error: unknown) {
  const setError = vi.fn();
  const placed = placeServerError<Fields>(error, FIELDS, setError);
  return { placed, setError };
}

describe('placeServerError', () => {
  it.each([
    ['INVALID_CREDENTIALS', 401, 'The email or password is incorrect.'],
    [
      'RATE_LIMITED',
      429,
      'Too many attempts from this network. Please wait a minute, then try again.',
    ],
    ['NETWORK_ERROR', 0, 'We could not reach the server. Check your connection and try again.'],
    [
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      'Something went wrong on our side. Please try again in a moment.',
    ],
    ['INTERNAL_ERROR', 500, 'Something went wrong on our side. Please try again in a moment.'],
  ] as const)('answers %s with its own words, never the server detail', (code, status, message) => {
    expect(place(failure(code, status)).placed).toEqual({ message });
  });

  it('puts "email already registered" on the email field, in its own words', () => {
    const { placed, setError } = place(failure('EMAIL_ALREADY_REGISTERED', 409));

    expect(placed).toEqual({ field: 'email' });
    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'An account with this email already exists.',
    });
  });

  it("shows each field's first rule, as the contract words it, and points at the topmost", () => {
    const { placed, setError } = place(
      failure('VALIDATION_FAILED', 400, [
        { field: 'password', message: 'Password must contain at least one number' },
        { field: 'password', message: 'Password must be at least 8 characters long' },
        { field: 'email', message: 'Enter a valid email address' },
      ]),
    );

    expect(placed).toEqual({ field: 'email' });
    expect(setError.mock.calls).toEqual([
      ['password', { type: 'server', message: 'Password must contain at least one number' }],
      ['email', { type: 'server', message: 'Enter a valid email address' }],
    ]);
  });

  it('explains a rejection the server could not pin on any field of the form', () => {
    const { placed } = place(
      failure('VALIDATION_FAILED', 400, [{ message: 'The request body must be a JSON object' }]),
    );

    expect(placed).toEqual({
      message: 'Some of these details were not accepted. Check them and try again.',
    });
  });

  it('treats anything that is not an API error as unexpected', () => {
    expect(place(new TypeError('x is undefined')).placed).toEqual({
      message: FORM_MESSAGES.INTERNAL_ERROR,
    });
  });
});
