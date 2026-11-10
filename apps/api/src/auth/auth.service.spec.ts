import { JwtService } from '@nestjs/jwt';
import { InMemoryRefreshTokenRepository } from '../../test/fakes/in-memory-refresh-token.repository.js';
import { InMemoryUsersRepository } from '../../test/fakes/in-memory-users.repository.js';
import { createTestConfig } from '../../test/support/test-config.js';
import { EmailAlreadyRegisteredError } from '../users/users.errors.js';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import { InvalidCredentialsError, InvalidRefreshTokenError } from './auth.errors.js';
import { AuthService } from './auth.service.js';
import { createJwtOptions } from './jwt.options.js';
import { PasswordHasher } from './password-hasher.js';
import { RefreshTokenService } from './refresh-tokens/refresh-token.service.js';

const ada = { email: 'ada@example.com', name: 'Ada Lovelace', password: 'Analytical1!' };

describe('AuthService', () => {
  let users: InMemoryUsersRepository;
  let refreshTokenStore: InMemoryRefreshTokenRepository;
  let passwords: PasswordHasher;
  let accessTokens: AccessTokenService;
  let auth: AuthService;

  beforeEach(() => {
    const config = createTestConfig();
    users = new InMemoryUsersRepository();
    refreshTokenStore = new InMemoryRefreshTokenRepository();
    passwords = new PasswordHasher();
    accessTokens = new AccessTokenService(new JwtService(createJwtOptions(config)), config);
    auth = new AuthService(
      new UsersService(users),
      passwords,
      accessTokens,
      new RefreshTokenService(refreshTokenStore, config),
    );
  });

  afterEach(() => vi.restoreAllMocks());

  describe('signUp', () => {
    it('creates the account and starts a session for it', async () => {
      const result = await auth.signUp(ada);

      expect(result.user).toEqual({
        id: expect.any(String),
        email: ada.email,
        name: ada.name,
        createdAt: expect.any(Date),
      });
      await expect(accessTokens.verify(result.accessToken.token)).resolves.toEqual({
        id: result.user.id,
      });
      expect(refreshTokenStore.all).toHaveLength(1);
    });

    it('stores an argon2id hash, never the password', async () => {
      await auth.signUp(ada);

      const [record] = users.records;
      expect(record?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(record?.passwordHash).not.toContain(ada.password);
    });

    it('refuses an email that is already registered', async () => {
      await auth.signUp(ada);

      await expect(auth.signUp({ ...ada, name: 'Another Ada' })).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
      expect(users.records).toHaveLength(1);
    });
  });

  describe('signIn', () => {
    beforeEach(async () => {
      await auth.signUp(ada);
    });

    it('starts a session and never returns the password hash', async () => {
      const result = await auth.signIn({ email: ada.email, password: ada.password });

      expect(result.user).toEqual({
        id: expect.any(String),
        email: ada.email,
        name: ada.name,
        createdAt: expect.any(Date),
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(refreshTokenStore.all).toHaveLength(2);
    });

    it('rejects a wrong password', async () => {
      await expect(auth.signIn({ email: ada.email, password: 'Wrong-password-1' })).rejects.toEqual(
        new InvalidCredentialsError(),
      );
    });

    it('answers an unknown email exactly like a wrong password, after a real hash check', async () => {
      const dummyCheck = vi.spyOn(passwords, 'verifyWithoutAccount');

      await expect(
        auth.signIn({ email: 'nobody@example.com', password: ada.password }),
      ).rejects.toEqual(new InvalidCredentialsError());
      expect(dummyCheck).toHaveBeenCalledOnce();
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const session = await auth.signUp(ada);

      const refreshed = await auth.refresh(session.refreshToken.token);

      expect(refreshed.user.id).toBe(session.user.id);
      expect(refreshed.refreshToken.token).not.toBe(session.refreshToken.token);
      await expect(accessTokens.verify(refreshed.accessToken.token)).resolves.toEqual({
        id: session.user.id,
      });
    });

    it('rejects a request without a refresh token', async () => {
      await expect(auth.refresh(undefined)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    });

    it('ends the session when the account no longer exists', async () => {
      const session = await auth.signUp(ada);
      users.records.length = 0;

      await expect(auth.refresh(session.refreshToken.token)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });
  });

  describe('signOut', () => {
    it('revokes the session, so its refresh token stops working', async () => {
      const session = await auth.signUp(ada);

      await auth.signOut(session.refreshToken.token);

      expect(refreshTokenStore.all).toEqual([]);
      await expect(auth.refresh(session.refreshToken.token)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    });

    it('succeeds without a refresh token', async () => {
      await expect(auth.signOut(undefined)).resolves.toBeUndefined();
    });
  });
});
