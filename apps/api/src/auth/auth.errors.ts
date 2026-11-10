import { ERROR_CODES } from '@nest-react-auth/contracts';
import { AppError } from '../common/errors/app-error.js';

/** One message for "no such email" and "wrong password", so sign-in doesn't reveal which accounts exist. */
export class InvalidCredentialsError extends AppError {
  readonly code = ERROR_CODES.INVALID_CREDENTIALS;

  constructor() {
    super('The email or password is incorrect.');
  }
}

export class InvalidRefreshTokenError extends AppError {
  readonly code = ERROR_CODES.INVALID_REFRESH_TOKEN;

  constructor() {
    super('Your session has ended. Please sign in again.');
  }
}
