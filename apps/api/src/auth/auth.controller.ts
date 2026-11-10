import { Body, Controller, Cookies, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthSession,
  type SignInData,
  signInSchema,
  type SignUpData,
  signUpSchema,
} from '@nest-react-auth/contracts';
import { Public } from '../common/auth/public.decorator.js';
import { API_VERSION, RATE_LIMITS, REFRESH_TOKEN_COOKIE } from '../common/http/api.constants.js';
import { toUserProfile } from '../users/user.js';
import { ApiRefresh, ApiSignIn, ApiSignOut, ApiSignUp } from './auth.docs.js';
import { InvalidRefreshTokenError } from './auth.errors.js';
import { type AuthResult, AuthService } from './auth.service.js';
import { RefreshTokenCookie } from './refresh-token.cookie.js';

@ApiTags('auth')
@Public()
@Controller({ path: 'auth', version: API_VERSION })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly refreshCookie: RefreshTokenCookie,
  ) {}

  @Post('sign-up')
  @Throttle({ default: RATE_LIMITS.credentials })
  @ApiSignUp()
  async signUp(
    @Body({ schema: signUpSchema }) body: SignUpData,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<AuthSession> {
    return this.startSession(response, await this.auth.signUp(body));
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: RATE_LIMITS.credentials })
  @ApiSignIn()
  async signIn(
    @Body({ schema: signInSchema }) body: SignInData,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<AuthSession> {
    return this.startSession(response, await this.auth.signIn(body));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiRefresh()
  async refresh(
    @Cookies(REFRESH_TOKEN_COOKIE) refreshToken: string | undefined,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<AuthSession> {
    try {
      return this.startSession(response, await this.auth.refresh(refreshToken));
    } catch (error) {
      // A dead token would only fail again, so drop the cookie. Any other failure
      // (the database being down, say) leaves the session alone.
      if (error instanceof InvalidRefreshTokenError) this.refreshCookie.clear(response);
      throw error;
    }
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiSignOut()
  async signOut(
    @Cookies(REFRESH_TOKEN_COOKIE) refreshToken: string | undefined,
    @Res({ passthrough: true }) response: unknown,
  ): Promise<void> {
    await this.auth.signOut(refreshToken);
    this.refreshCookie.clear(response);
  }

  private startSession(response: unknown, result: AuthResult): AuthSession {
    this.refreshCookie.write(response, result.refreshToken);
    return {
      accessToken: result.accessToken.token,
      tokenType: 'Bearer',
      expiresIn: result.accessToken.expiresIn,
      user: toUserProfile(result.user),
    };
  }
}
