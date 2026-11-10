import { Injectable, Logger } from '@nestjs/common';
import type { SignInData, SignUpData } from '@nest-react-auth/contracts';
import type { User } from '../users/user.js';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService, type IssuedAccessToken } from './access-token.service.js';
import { InvalidCredentialsError, InvalidRefreshTokenError } from './auth.errors.js';
import { PasswordHasher } from './password-hasher.js';
import type { IssuedRefreshToken } from './refresh-tokens/refresh-token.js';
import { RefreshTokenService } from './refresh-tokens/refresh-token.service.js';

export interface AuthResult {
  user: User;
  accessToken: IssuedAccessToken;
  refreshToken: IssuedRefreshToken;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /** @throws EmailAlreadyRegisteredError when the email is already taken. */
  async signUp({ email, name, password }: SignUpData): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(password);
    const user = await this.users.register({ email, name, passwordHash });
    this.logger.log({ userId: user.id }, 'User signed up');
    return this.startSession(user);
  }

  /** @throws InvalidCredentialsError for an unknown email or a wrong password, alike. */
  async signIn({ email, password }: SignInData): Promise<AuthResult> {
    const account = await this.users.findForSignIn(email);
    const passwordMatches = account
      ? await this.passwords.verify(account.passwordHash, password)
      : await this.passwords.verifyWithoutAccount(password);

    if (!account || !passwordMatches) {
      this.logger.warn({ userId: account?.id }, 'Sign-in failed');
      throw new InvalidCredentialsError();
    }

    const { passwordHash: _passwordHash, ...user } = account;
    this.logger.log({ userId: user.id }, 'User signed in');
    return this.startSession(user);
  }

  /**
   * Exchanges the refresh token for a new pair of tokens.
   * @throws InvalidRefreshTokenError when the token is missing, unknown, expired or reused.
   */
  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) throw new InvalidRefreshTokenError();

    const rotated = await this.refreshTokens.rotate(refreshToken);
    const user = await this.users.findById(rotated.userId);
    if (!user) throw new InvalidRefreshTokenError();

    return { user, accessToken: await this.accessTokens.issue(user.id), refreshToken: rotated };
  }

  async signOut(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.refreshTokens.revoke(refreshToken);
  }

  private async startSession(user: User): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.accessTokens.issue(user.id),
      this.refreshTokens.issue(user.id),
    ]);
    return { user, accessToken, refreshToken };
  }
}
