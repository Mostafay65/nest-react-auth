import { authSessionSchema, type SignInData, type SignUpData } from '@nest-react-auth/contracts';
import { requestJson, requestNoContent } from '@/shared/http/request';

const AUTH = '/api/v1/auth';

/**
 * A refresh the browser gives up on may still rotate the token on the server.
 * The next refresh would then send the retired token, which the API takes for
 * theft, ending the session in every tab. So a refresh waits as long as nginx
 * waits for the API (its default `proxy_read_timeout`), not the usual 10 s.
 */
const REFRESH_TIMEOUT_MS = 60_000;

/** The auth endpoints. The refresh token travels only in its cookie, which the browser attaches. */
export const authApi = {
  signUp: (body: SignUpData) =>
    requestJson(`${AUTH}/sign-up`, authSessionSchema, { method: 'POST', body }),

  signIn: (body: SignInData) =>
    requestJson(`${AUTH}/sign-in`, authSessionSchema, { method: 'POST', body }),

  refresh: () =>
    requestJson(`${AUTH}/refresh`, authSessionSchema, {
      method: 'POST',
      timeoutMs: REFRESH_TIMEOUT_MS,
    }),

  signOut: () => requestNoContent(`${AUTH}/sign-out`, { method: 'POST' }),
};
