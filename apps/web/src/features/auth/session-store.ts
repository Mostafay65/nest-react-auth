import type { AuthSession, UserProfile } from '@nest-react-auth/contracts';

export type Session =
  | { readonly status: 'unknown' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'signed-in'; readonly user: UserProfile; readonly accessToken: string };

const UNKNOWN: Session = { status: 'unknown' };
const SIGNED_OUT: Session = { status: 'signed-out' };

let current: Session = UNKNOWN;
const listeners = new Set<() => void>();

function publish(next: Session): void {
  current = next;
  for (const listener of listeners) listener();
}

/**
 * The session lives in memory only. The access token never touches
 * localStorage, so it dies with the tab; the refresh token is an httpOnly
 * cookie that no script can read, and a reload restores the session from it.
 */
export const sessionStore = {
  get: (): Session => current,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  accessToken: (): string | undefined =>
    current.status === 'signed-in' ? current.accessToken : undefined,

  start(session: AuthSession): void {
    publish({ status: 'signed-in', user: session.user, accessToken: session.accessToken });
  },

  end(): void {
    publish(SIGNED_OUT);
  },

  /** Back to "not checked yet", so the next navigation restores the session from the cookie. */
  reset(): void {
    publish(UNKNOWN);
  },
};
