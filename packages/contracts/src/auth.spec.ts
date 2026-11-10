import { describe, expect, it } from 'vitest';
import { signInSchema, signUpSchema } from './auth.js';
import { PASSWORD_RULES } from './password-policy.js';

const validSignUp = { email: 'ada@example.com', name: 'Ada Lovelace', password: 'Analytical1!' };

const messagesFor = (result: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  (result.error?.issues ?? []).map(({ path, message }) => ({ field: path.join('.'), message }));

describe('signUpSchema', () => {
  it('accepts a valid body and normalises email and name', () => {
    const result = signUpSchema.parse({
      ...validSignUp,
      email: '  Ada@Example.COM ',
      name: '  Ada Lovelace  ',
    });

    expect(result).toEqual({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      password: 'Analytical1!',
    });
  });

  it('keeps the password exactly as typed', () => {
    const result = signUpSchema.parse({ ...validSignUp, password: '  spaced 1! ' });
    expect(result.password).toBe('  spaced 1! ');
  });

  it('reports every failed password rule at once', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: 'short' });

    expect(messagesFor(result)).toEqual(
      PASSWORD_RULES.filter(({ id }) => id !== 'letter').map(({ message }) => ({
        field: 'password',
        message,
      })),
    );
  });

  it('rejects passwords longer than 128 characters', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: `${'a1!'.repeat(43)}` });
    expect(messagesFor(result)).toEqual([
      { field: 'password', message: 'Password must be at most 128 characters long' },
    ]);
  });

  it('asks for the password, not for every rule, when it is empty', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: '' });
    expect(messagesFor(result)).toEqual([{ field: 'password', message: 'Password is required' }]);
  });

  it.each([
    ['not-an-email', 'Enter a valid email address'],
    ['ada@', 'Enter a valid email address'],
    ['   ', 'Email is required'],
  ])('rejects the email %j', (email, message) => {
    const result = signUpSchema.safeParse({ ...validSignUp, email });
    expect(messagesFor(result)).toEqual([{ field: 'email', message }]);
  });

  it('checks the name length after trimming', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, name: '  Al  ' });
    expect(messagesFor(result)).toEqual([
      { field: 'name', message: 'Name must be at least 3 characters long' },
    ]);
  });

  it('rejects names longer than 50 characters', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, name: 'a'.repeat(51) });
    expect(messagesFor(result)).toEqual([
      { field: 'name', message: 'Name must be at most 50 characters long' },
    ]);
  });

  it('reports missing fields with a readable message', () => {
    const result = signUpSchema.safeParse({});
    expect(messagesFor(result)).toEqual([
      { field: 'email', message: 'Email is required' },
      { field: 'name', message: 'Name is required' },
      { field: 'password', message: 'Password is required' },
    ]);
  });

  it.each([undefined, null, 'text', []])('asks for a JSON object when the body is %j', (body) => {
    const result = signUpSchema.safeParse(body);
    expect(messagesFor(result)).toEqual([
      { field: '', message: 'The request body must be a JSON object' },
    ]);
  });

  it('rejects unknown fields instead of silently dropping them', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, role: 'admin' });
    expect(result.success).toBe(false);
  });

  it('rejects operator objects such as NoSQL injection payloads', () => {
    const result = signUpSchema.safeParse({ ...validSignUp, email: { $ne: null } });
    expect(messagesFor(result)).toEqual([{ field: 'email', message: 'Email must be a string' }]);
  });
});

describe('signInSchema', () => {
  it('normalises the email and keeps the password as typed', () => {
    expect(signInSchema.parse({ email: ' Ada@Example.com', password: 'x' })).toEqual({
      email: 'ada@example.com',
      password: 'x',
    });
  });

  it('does not apply the sign-up password policy', () => {
    expect(signInSchema.safeParse({ email: 'ada@example.com', password: 'weak' }).success).toBe(
      true,
    );
  });

  it('requires a non-empty password', () => {
    const result = signInSchema.safeParse({ email: 'ada@example.com', password: '' });
    expect(messagesFor(result)).toEqual([{ field: 'password', message: 'Password is required' }]);
  });
});
