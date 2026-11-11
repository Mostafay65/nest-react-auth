import type { AuthSession } from '@nest-react-auth/contracts';
import { isUnauthorized } from '@/shared/http/api-error';
import { authApi } from './auth-api';
import { announce, type SessionEvent } from './session-channel';
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
  const wasSignedIn = sessionStore.get().status === 'signed-in';
  try {
    sessionStore.start(await authApi.refresh());
    return true;
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    sessionStore.end();
    // A signed-in tab has learnt that the shared cookie stopped working, so the
    // other tabs' sessions are over too. A tab that was only starting up has
    // learnt nothing: it may have asked just before another tab's sign-in set
    // the cookie, and announcing would sign that tab out.
    if (wasSignedIn) announce('signed-out');
    return false;
  }
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  // Web Locks exist only in secure contexts (HTTPS and localhost).
  if (!('locks' in navigator)) return task();
  return navigator.locks.request(REFRESH_LOCK, task);
}

/**
 * Resolves once the session is known. Only the first call asks the server.
 * When the server can't be reached it rejects and the session stays unknown,
 * so the error page can offer to try again, and the next navigation asks again.
 */
export async function ensureSession(): Promise<Session> {
  if (sessionStore.get().status === 'unknown') await refreshSession();
  return sessionStore.get();
}

/** Starts the session a sign-in or sign-up returned, and tells the other tabs. */
export function startSession(session: AuthSession): void {
  sessionStore.start(session);
  announce('signed-in');
}

/**
 * Ends the session on the server first. If the server can't be reached this
 * rejects and keeps the session: clearing only memory would leave a refresh
 * cookie that signs the user back in on the next reload.
 */
export async function signOut(): Promise<void> {
  await authApi.signOut();
  sessionStore.end();
  announce('signed-out');
}

/**
 * Follows a sign-in or sign-out announced by another tab, and says whether
 * this tab's session changed, in which case the route guards must run again.
 *
 * It never announces anything itself, so tabs can't set each other off in a
 * loop. The most a followed sign-in can cause is one refresh, and if that
 * refresh is refused, one sign-out that the other tabs follow in silence.
 */
export function followOtherTab(event: SessionEvent): boolean {
  const { status } = sessionStore.get();

  if (event === 'signed-out') {
    if (status === 'signed-out') return false;
    sessionStore.end();
    return true;
  }

  if (status === 'signed-in') return false;
  // Unknown again: the guards then restore the session from the new refresh cookie.
  sessionStore.reset();
  return true;
}
