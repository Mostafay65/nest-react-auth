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

  it('counts an emoji as one character, as the API stores it', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, name: '😀'.repeat(50) }).success).toBe(true);
    const result = signUpSchema.safeParse({ ...validSignUp, name: '😀'.repeat(51) });
    expect(messagesFor(result)).toEqual([
      { field: 'name', message: 'Name must be at most 50 characters long' },
    ]);
  });

  it.each([
    ['zero-width spaces', '\u200B\u200B\u200B'],
    ['Hangul fillers', '\u3164\u3164\u3164'],
    ['two letters padded with a zero-width joiner', 'A\u200DB'],
    ['spaces between zero-width spaces', '\u200B   \u200B'],
  ])('does not count invisible characters towards the minimum: %s', (_case, name) => {
    const result = signUpSchema.safeParse({ ...validSignUp, name });
    expect(messagesFor(result)).toEqual([
      { field: 'name', message: 'Name must be at least 3 characters long' },
    ]);
  });

  it.each([
    ['a line break', 'Ada\nLovelace'],
    ['a NUL character', 'Ada\u0000Lovelace'],
    ['a right-to-left override', 'Ada \u202ELovelace'],
  ])('rejects a name with %s', (_case, name) => {
    const result = signUpSchema.safeParse({ ...validSignUp, name });
    expect(messagesFor(result)).toEqual([
      { field: 'name', message: 'Name must not contain line breaks or control characters' },
    ]);
  });

  it('counts the space between two initials, as the user sees it', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, name: 'A B' }).success).toBe(true);
  });

  it('accepts names in any script, joiners included', () => {
    for (const name of ['李小龍', 'Zoë Ångström', 'علی\u200Cرضا']) {
      expect(signUpSchema.safeParse({ ...validSignUp, name }).success, name).toBe(true);
    }
  });

  it('stores accented names in one form (NFC), however they were typed', () => {
    const decomposed = 'Zoë Lovelace';
    expect(signUpSchema.parse({ ...validSignUp, name: decomposed }).name).toBe('Zoë Lovelace');
  });

  it('normalises the password (NFKC), so composed and decomposed accents match', () => {
    const composed = signUpSchema.parse({ ...validSignUp, password: 'Café-1234!' });
    const decomposed = signUpSchema.parse({ ...validSignUp, password: 'Café-1234!' });
    expect(decomposed.password).toBe(composed.password);
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

  it('normalises the password the same way as sign-up', () => {
    const signIn = signInSchema.parse({ email: 'ada@example.com', password: 'Café-1234!' });
    expect(signIn.password).toBe(
      signUpSchema.parse({ ...validSignUp, password: 'Café-1234!' }).password,
    );
  });
});
