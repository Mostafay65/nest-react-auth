import type { NewRefreshToken, StoredRefreshToken } from './refresh-token.js';

/** Persistence port for refresh tokens. See UsersRepository for why it is an abstract class. */
export abstract class RefreshTokenRepository {
  abstract create(token: NewRefreshToken): Promise<void>;

  abstract findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;

  /**
   * Marks the token used, atomically. Returns false if it was already used,
   * so two concurrent requests can never both exchange the same token.
   */
  abstract markUsed(id: string, usedAt: Date): Promise<boolean>;

  abstract deleteFamily(familyId: string): Promise<void>;
}
