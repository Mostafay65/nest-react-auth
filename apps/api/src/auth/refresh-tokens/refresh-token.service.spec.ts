import { Logger } from '@nestjs/common';
import { InMemoryRefreshTokenRepository } from '../../../test/fakes/in-memory-refresh-token.repository.js';
import { createTestConfig } from '../../../test/support/test-config.js';
import { InvalidRefreshTokenError } from '../auth.errors.js';
import { hashRefreshToken } from './refresh-token.crypto.js';
import { RefreshTokenService } from './refresh-token.service.js';

const USER_ID = '665f1c2e8b3a4d0012345678';
const ONE_HOUR = 3_600;

describe('RefreshTokenService', () => {
  let store: InMemoryRefreshTokenRepository;
  let service: RefreshTokenService;

  beforeEach(() => {
    store = new InMemoryRefreshTokenRepository();
    const config = createTestConfig({ REFRESH_TOKEN_TTL_SECONDS: String(ONE_HOUR) });
    service = new RefreshTokenService(store, config);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('issue', () => {
    it('returns a 256-bit token and stores only its hash', async () => {
      const issued = await service.issue(USER_ID);

      expect(issued.token).toMatch(/^[\w-]{43}$/);
      expect(store.all).toEqual([
        expect.objectContaining({
          userId: USER_ID,
          tokenHash: hashRefreshToken(issued.token),
          usedAt: null,
        }),
      ]);
      expect(JSON.stringify(store.all)).not.toContain(issued.token);
    });

    it('expires the token after the configured lifetime', async () => {
      vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });

      const issued = await service.issue(USER_ID);

      expect(issued.expiresAt).toEqual(new Date('2026-01-01T01:00:00Z'));
    });

    it('starts a new family, i.e. a separate session, on every call', async () => {
      await service.issue(USER_ID);
      await service.issue(USER_ID);

      const [first, second] = store.all;
      expect(first?.familyId).not.toBe(second?.familyId);
    });
  });

  describe('rotate', () => {
    it('retires the token and issues its successor in the same family', async () => {
      const issued = await service.issue(USER_ID);

      const rotated = await service.rotate(issued.token);

      expect(rotated.token).not.toBe(issued.token);
      expect(rotated.userId).toBe(USER_ID);
      const [retired, successor] = store.all;
      expect(retired?.usedAt).toBeInstanceOf(Date);
      expect(successor).toMatchObject({
        familyId: retired?.familyId,
        tokenHash: hashRefreshToken(rotated.token),
        usedAt: null,
      });
    });

    it('rejects a token it never issued', async () => {
      await service.issue(USER_ID);

      await expect(service.rotate('forged-token')).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      expect(store.all).toHaveLength(1);
    });

    it('rejects an expired token', async () => {
      vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      const issued = await service.issue(USER_ID);
      vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));

      await expect(service.rotate(issued.token)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    });

    it('revokes the whole family when a retired token comes back', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn');
      const stolen = await service.issue(USER_ID);
      const latest = await service.rotate(stolen.token);
      const otherSession = await service.issue(USER_ID);

      await expect(service.rotate(stolen.token)).rejects.toBeInstanceOf(InvalidRefreshTokenError);

      await expect(service.rotate(latest.token)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
      await expect(service.rotate(otherSession.token)).resolves.toMatchObject({ userId: USER_ID });
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID }),
        'Refresh token reuse detected; session revoked',
      );
    });

    it('lets only one of two simultaneous exchanges of the same token succeed', async () => {
      const issued = await service.issue(USER_ID);

      const results = await Promise.allSettled([
        service.rotate(issued.token),
        service.rotate(issued.token),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    });
  });

  describe('revoke', () => {
    it('deletes every token of the session', async () => {
      const issued = await service.issue(USER_ID);
      const rotated = await service.rotate(issued.token);

      await service.revoke(rotated.token);

      expect(store.all).toEqual([]);
    });

    it('ignores a token it does not know, so signing out twice is harmless', async () => {
      await service.issue(USER_ID);

      await expect(service.revoke('unknown-token')).resolves.toBeUndefined();
      expect(store.all).toHaveLength(1);
    });
  });
});
