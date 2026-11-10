import { type MiddlewareFunction, redirect } from 'react-router';
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

export const requireSignedIn: MiddlewareFunction = () => {
  if (sessionStore.get().status !== 'signed-in') throw redirect(paths.signIn);
};

export const requireSignedOut: MiddlewareFunction = () => {
  if (sessionStore.get().status === 'signed-in') throw redirect(paths.app);
};

export const redirectHome = () =>
  redirect(sessionStore.get().status === 'signed-in' ? paths.app : paths.signIn);
