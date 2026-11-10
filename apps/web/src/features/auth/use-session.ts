import { useSyncExternalStore } from 'react';
import { type Session, sessionStore } from './session-store';

export const useSession = (): Session =>
  useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
