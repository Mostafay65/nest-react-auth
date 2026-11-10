import type {
  NewRefreshToken,
  StoredRefreshToken,
} from '../../src/auth/refresh-tokens/refresh-token.js';
import type { RefreshTokenRepository } from '../../src/auth/refresh-tokens/refresh-token.repository.js';

export interface RefreshTokenRecord extends StoredRefreshToken {
  tokenHash: string;
}

/** Stands in for MongooseRefreshTokenRepository in unit tests. */
export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private readonly records = new Map<string, RefreshTokenRecord>();
  private sequence = 0;

  /** Every stored token, oldest first. */
  get all(): RefreshTokenRecord[] {
    return [...this.records.values()];
  }

  async create(token: NewRefreshToken): Promise<void> {
    const id = String(++this.sequence);
    this.records.set(id, { ...token, id, usedAt: null });
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    const record = this.all.find((candidate) => candidate.tokenHash === tokenHash);
    if (!record) return null;
    const { tokenHash: _tokenHash, ...stored } = record;
    return stored;
  }

  async markUsed(id: string, usedAt: Date): Promise<boolean> {
    const record = this.records.get(id);
    if (!record || record.usedAt) return false;
    record.usedAt = usedAt;
    return true;
  }

  async deleteFamily(familyId: string): Promise<void> {
    for (const record of this.all) {
      if (record.familyId === familyId) this.records.delete(record.id);
    }
  }
}
