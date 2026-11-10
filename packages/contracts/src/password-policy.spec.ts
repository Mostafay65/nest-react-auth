import { describe, expect, it } from 'vitest';
import { PASSWORD_RULES, type PasswordRuleId } from './password-policy.js';

const rule = (id: PasswordRuleId) => {
  const found = PASSWORD_RULES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown rule ${id}`);
  return found;
};

describe('PASSWORD_RULES', () => {
  it('lists the four rules from the spec, in a stable order', () => {
    expect(PASSWORD_RULES.map(({ id }) => id)).toEqual(['length', 'letter', 'number', 'special']);
  });

  describe('length', () => {
    it.each([
      ['7 characters', 'abc1234', false],
      ['8 characters', 'abc12345', true],
    ])('%s -> %s', (_label, password, expected) => {
      expect(rule('length').test(password)).toBe(expected);
    });

    it('counts code points, so an emoji is one character, not two UTF-16 units', () => {
      expect(rule('length').test('😀'.repeat(7))).toBe(false);
      expect(rule('length').test('😀'.repeat(8))).toBe(true);
    });
  });

  describe('letter', () => {
    it.each([
      ['Latin', 'a', true],
      ['Arabic', 'م', true],
      ['digits only', '12345678', false],
      ['symbols only', '!@#$%^&*', false],
    ])('%s -> %s', (_label, password, expected) => {
      expect(rule('letter').test(password)).toBe(expected);
    });
  });

  describe('number', () => {
    it.each([
      ['ASCII digit', 'a1', true],
      ['Arabic-Indic digit', 'a٣', true],
      ['letters only', 'abcdefgh', false],
    ])('%s -> %s', (_label, password, expected) => {
      expect(rule('number').test(password)).toBe(expected);
    });
  });

  describe('special', () => {
    it.each([
      ['punctuation', 'a!', true],
      ['symbol', 'a+', true],
      ['currency symbol', 'a€', true],
      ['space is not special', 'a b', false],
      ['letters and digits only', 'abc123', false],
      ['Arabic diacritic is not special', 'مُ', false],
    ])('%s -> %s', (_label, password, expected) => {
      expect(rule('special').test(password)).toBe(expected);
    });
  });
});
