import { type MiddlewareFunction, replace } from 'react-router';
import { paths } from '@/shared/paths';
import { ensureSession } from './session';
import { sessionStore } from './session-store';

/**
 * Root middleware. On the first navigation it restores the session from the
 * refresh cookie, so every guard below it sees a settled session.
 */
export const settleSession: MiddlewareFunction = async () => {
  await ensureSession();
};

// The guards answer with `replace`, not `redirect`. A redirect adds a history
// entry, so pressing Back onto a guarded page would push the user forward
// again, and they could never go back past it.

export const requireSignedIn: MiddlewareFunction = () => {
  if (sessionStore.get().status !== 'signed-in') throw replace(paths.signIn);
};

export const requireSignedOut: MiddlewareFunction = () => {
  if (sessionStore.get().status === 'signed-in') throw replace(paths.app);
};

export const redirectHome = () =>
  replace(sessionStore.get().status === 'signed-in' ? paths.app : paths.signIn);
