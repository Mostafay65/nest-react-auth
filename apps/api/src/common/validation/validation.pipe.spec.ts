import type { ArgumentMetadata } from '@nestjs/common';
import { signUpSchema } from '@nest-react-auth/contracts';
import { z } from 'zod';
import { RequestValidationError } from '../errors/app-error.js';
import { createValidationPipe } from './validation.pipe.js';

const bodyWith = (schema: z.ZodType): ArgumentMetadata => ({ type: 'body', schema });

describe('createValidationPipe', () => {
  const pipe = createValidationPipe();

  it('returns the parsed value, normalised by the schema', async () => {
    const body = { email: '  Ada@Example.com ', name: ' Ada ', password: 'Analytical1!' };

    await expect(pipe.transform(body, bodyWith(signUpSchema))).resolves.toEqual({
      email: 'ada@example.com',
      name: 'Ada',
      password: 'Analytical1!',
    });
  });

  it('reports every invalid field at once, one entry per issue', async () => {
    const failure = pipe.transform({ email: 'nope', name: 'Al' }, bodyWith(signUpSchema));

    await expect(failure).rejects.toBeInstanceOf(RequestValidationError);
    await expect(failure).rejects.toMatchObject({
      errors: [
        { field: 'email', message: 'Enter a valid email address' },
        { field: 'name', message: 'Name must be at least 3 characters long' },
        { field: 'password', message: 'Password is required' },
      ],
    });
  });

  it('joins nested paths with dots and leaves out the field for body-level issues', async () => {
    const schema = z.strictObject({ address: z.object({ city: z.string() }) });

    await expect(pipe.transform({ address: {} }, bodyWith(schema))).rejects.toMatchObject({
      errors: [{ field: 'address.city', message: expect.any(String) }],
    });
    await expect(pipe.transform(null, bodyWith(schema))).rejects.toMatchObject({
      errors: [{ message: expect.any(String) }],
    });
  });

  it('leaves parameters without a schema alone', async () => {
    await expect(pipe.transform('raw', { type: 'query' })).resolves.toBe('raw');
  });
});
