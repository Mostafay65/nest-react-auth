import { authSessionSchema, type SignInData, type SignUpData } from '@nest-react-auth/contracts';
import { requestJson, requestNoContent } from '@/shared/http/request';

const AUTH = '/api/v1/auth';

/** The auth endpoints. The refresh token travels only in its cookie, which the browser attaches. */
export const authApi = {
  signUp: (body: SignUpData) =>
    requestJson(`${AUTH}/sign-up`, authSessionSchema, { method: 'POST', body }),

  signIn: (body: SignInData) =>
    requestJson(`${AUTH}/sign-in`, authSessionSchema, { method: 'POST', body }),

  refresh: () => requestJson(`${AUTH}/refresh`, authSessionSchema, { method: 'POST' }),

  signOut: () => requestNoContent(`${AUTH}/sign-out`, { method: 'POST' }),
};
