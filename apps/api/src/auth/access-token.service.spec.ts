import { JwtService } from '@nestjs/jwt';
import { createTestConfig } from '../../test/support/test-config.js';
import { UnauthorizedError } from '../common/errors/app-error.js';
import { AccessTokenService } from './access-token.service.js';
import { createJwtOptions, JWT_AUDIENCE, JWT_ISSUER } from './jwt.options.js';

const USER_ID = '665f1c2e8b3a4d0012345678';

describe('AccessTokenService', () => {
  const config = createTestConfig({ ACCESS_TOKEN_TTL_SECONDS: '900' });
  const jwt = new JwtService(createJwtOptions(config));
  const accessTokens = new AccessTokenService(jwt, config);

  afterEach(() => vi.useRealTimers());

  it('issues a token that verifies back to the user', async () => {
    const issued = await accessTokens.issue(USER_ID);

    expect(issued.expiresIn).toBe(900);
    await expect(accessTokens.verify(issued.token)).resolves.toEqual({ id: USER_ID });
  });

  it('signs with HS256 and names the issuer and audience', async () => {
    const { token } = await accessTokens.issue(USER_ID);

    expect(jwt.decode(token, { complete: true })).toMatchObject({
      header: { alg: 'HS256' },
      payload: { sub: USER_ID, iss: JWT_ISSUER, aud: JWT_AUDIENCE, jti: expect.any(String) },
    });
  });

  it('makes every token unique, even two issued in the same second', async () => {
    const [first, second] = await Promise.all([
      accessTokens.issue(USER_ID),
      accessTokens.issue(USER_ID),
    ]);

    expect(first.token).not.toBe(second.token);
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const { token } = await accessTokens.issue(USER_ID);
    vi.setSystemTime(new Date('2026-01-01T00:15:00Z'));

    await expect(accessTokens.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token whose payload was changed', async () => {
    const { token } = await accessTokens.issue(USER_ID);
    const [header, , signature] = token.split('.');
    const forgedPayload = encode({ sub: 'someone-else', iss: JWT_ISSUER, aud: JWT_AUDIENCE });
    const forged = `${header}.${forgedPayload}.${signature}`;

    await expect(accessTokens.verify(forged)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token signed with another secret', async () => {
    const otherConfig = createTestConfig({
      JWT_ACCESS_SECRET: 'another-secret-that-is-also-32-characters-long',
    });
    const foreign = new JwtService(createJwtOptions(otherConfig));

    const token = await foreign.signAsync({ sub: USER_ID }, { expiresIn: 900 });

    await expect(accessTokens.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an unsigned token (alg: none)', async () => {
    const now = Math.floor(Date.now() / 1_000);
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: USER_ID,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: now,
      exp: now + 900,
    })}.`;

    await expect(accessTokens.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token meant for another audience', async () => {
    const token = await jwt.signAsync(
      { sub: USER_ID },
      { audience: 'another-service', expiresIn: 900 },
    );

    await expect(accessTokens.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a validly signed token without a subject', async () => {
    const token = await jwt.signAsync({ scope: 'none' }, { expiresIn: 900 });

    await expect(accessTokens.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a validly signed token that never expires', async () => {
    const token = await jwt.signAsync({ sub: USER_ID });
    expect(jwt.decode(token)).not.toHaveProperty('exp');

    await expect(accessTokens.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects something that is not a JWT at all', async () => {
    await expect(accessTokens.verify('not-a-jwt')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
