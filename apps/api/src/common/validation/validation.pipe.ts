import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { FieldError } from '@nest-react-auth/contracts';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { RequestValidationError } from '../errors/app-error.js';

/**
 * Validates every parameter declared with `{ schema }` (for example
 * `@Body({ schema: signUpSchema })`) and reports all failures at once, one
 * entry per field, instead of Nest's default list of strings.
 */
export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => new RequestValidationError(issues.map(toFieldError)),
  });
}

function toFieldError(issue: StandardSchemaV1.Issue): FieldError {
  const field = (issue.path ?? [])
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
    .join('.');
  return field ? { field, message: issue.message } : { message: issue.message };
}
