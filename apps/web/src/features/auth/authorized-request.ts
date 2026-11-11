import type { ZodType } from 'zod';
import { isUnauthorized } from '@/shared/http/api-error';
import { type RequestOptions, requestJson } from '@/shared/http/request';
import { refreshSession } from './session';
import { sessionStore } from './session-store';

/**
 * Calls a protected endpoint with the access token. A 401 means the token has
 * expired, so the session is refreshed once and the call retried once. If the
 * session is over, the 401 is passed on.
 */
export async function authorizedJson<T>(
  path: string,
  schema: ZodType<T>,
  options: Omit<RequestOptions, 'accessToken'> = {},
): Promise<T> {
  const call = () =>
    requestJson(path, schema, { ...options, accessToken: sessionStore.accessToken() });

  try {
    return await call();
  } catch (error) {
    if (!isUnauthorized(error) || !(await refreshSession())) throw error;
  }

  try {
    return await call();
  } catch (error) {
    // Even a fresh token was refused, so the session is no use. Ending it keeps
    // the user on sign-in; otherwise the sign-in guard, seeing a session, would
    // send them straight back here to fail again, in a loop.
    if (isUnauthorized(error)) sessionStore.end();
    throw error;
  }
}
