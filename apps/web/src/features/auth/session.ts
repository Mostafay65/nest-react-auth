import { isUnauthorized } from '@/shared/http/api-error';
import { authApi } from './auth-api';
import { type Session, sessionStore } from './session-store';

const REFRESH_LOCK = 'auth-refresh';

let refreshing: Promise<boolean> | null = null;

/**
 * Trades the refresh cookie for a new access token. Resolves true when the
 * session goes on and false when it is over (no cookie, expired or revoked);
 * rejects when the server can't be reached, leaving the session as it was.
 *
 * The API rotates the refresh token on every use and treats a second use of
 * one token as theft, ending the session. So callers in a tab share one
 * request, and tabs take turns through a Web Lock: each one sends the cookie
 * the previous tab received.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= withRefreshLock(exchangeRefreshToken).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function exchangeRefreshToken(): Promise<boolean> {
  try {
    sessionStore.start(await authApi.refresh());
    return true;
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    sessionStore.end();
    return false;
  }
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  // Web Locks exist only in secure contexts (HTTPS and localhost).
  if (!('locks' in navigator)) return task();
  return navigator.locks.request(REFRESH_LOCK, task);
}

/** Resolves once the session is known. Only the first call asks the server. */
export async function ensureSession(): Promise<Session> {
  if (sessionStore.get().status === 'unknown') {
    // An unreachable server reads as signed out; the sign-in form then says what went wrong.
    await refreshSession().catch(() => sessionStore.end());
  }
  return sessionStore.get();
}

/**
 * Ends the session on the server first. If the server can't be reached this
 * rejects and keeps the session: clearing only memory would leave a refresh
 * cookie that signs the user back in on the next reload.
 */
export async function signOut(): Promise<void> {
  await authApi.signOut();
  sessionStore.end();
}
