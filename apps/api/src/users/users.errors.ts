import { ERROR_CODES } from '@nest-react-auth/contracts';
import { AppError } from '../common/errors/app-error.js';

export class EmailAlreadyRegisteredError extends AppError {
  readonly code = ERROR_CODES.EMAIL_ALREADY_REGISTERED;

  constructor() {
    super('An account with this email already exists.');
  }
}

export class UserNotFoundError extends AppError {
  readonly code = ERROR_CODES.NOT_FOUND;

  constructor() {
    super('The user no longer exists.');
  }
}
