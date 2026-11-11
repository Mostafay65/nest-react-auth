import { z } from 'zod';

/**
 * Zod compiles object parsers with `new Function` when it can, and checks
 * whether it can as soon as a schema is built. The CSP forbids eval, and
 * browsers report the check as a violation even though Zod catches the error.
 * In jitless mode Zod skips both; parsing a few form fields doesn't need them.
 *
 * main.tsx imports this first, before any module that builds a schema.
 */
z.config({ jitless: true });
