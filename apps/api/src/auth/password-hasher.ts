import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

/**
 * argon2id with OWASP's recommended minimum (19 MiB, 2 passes, 1 lane). That
 * keeps a sign-in burst from exhausting memory in a small container, while the
 * cost stays well above what offline cracking can afford at scale.
 */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordHasher {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  /**
   * Runs one real verification against a throwaway hash, then returns false.
   * Sign-in calls it for unknown emails, so they take as long as a wrong
   * password and response times don't reveal which accounts exist.
   */
  async verifyWithoutAccount(password: string): Promise<false> {
    this.dummyHash ??= this.hash(randomBytes(32).toString('base64url'));
    await argon2.verify(await this.dummyHash, password);
    return false;
  }
}
