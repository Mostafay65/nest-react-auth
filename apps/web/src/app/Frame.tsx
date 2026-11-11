import { type ReactNode, useEffect, useRef } from 'react';
import {
  NavigationType,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigationType,
} from 'react-router';
import type { Session } from '@/features/auth/session-store';
import { useFollowOtherTabs } from '@/features/auth/use-follow-other-tabs';
import { useSession } from '@/features/auth/use-session';
import { RouteErrorPage } from '@/pages/error/RouteErrorPage';
import { isRetry } from '@/pages/error/retry';
import { paths } from '@/shared/paths';
import { type IndexEntry, Masthead } from '@/shared/ui/Masthead';
import styles from './Frame.module.css';

/** The masthead index for each session state. Until the session is known, it offers no links. */
const INDEX: Record<Session['status'], readonly IndexEntry[]> = {
  'signed-out': [
    { number: '01', label: 'Sign in', to: paths.signIn },
    { number: '02', label: 'Create account', to: paths.signUp },
  ],
  'signed-in': [{ number: '03', label: 'Application', to: paths.app }],
  unknown: [],
};

/** The root route. Every page renders in this frame. */
export function Frame() {
  useHeadingFocusOnNavigation();

  return (
    <>
      <PageLayout>
        <Outlet />
      </PageLayout>
      <ScrollRestoration />
    </>
  );
}

/** The root route's error boundary: the error page, in the same frame as every other page. */
export function ErrorFrame() {
  return (
    <PageLayout>
      <RouteErrorPage />
    </PageLayout>
  );
}

/** What every page shares: the skip link, the masthead and the main landmark. */
function PageLayout({ children }: { children: ReactNode }) {
  const session = useSession();
  useFollowOtherTabs();

  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <Masthead entries={INDEX[session.status]} />
      <main id="main" className={styles.main}>
        {children}
      </main>
    </>
  );
}

/**
 * Client-side navigation keeps focus on the link or button that was used, so
 * screen reader users would not hear that the page changed. Moving focus to
 * the new page's heading announces it. The first page load is left alone.
 *
 * A frame that mounts after "Try again" has no earlier page to compare with,
 * so it takes focus at once. A reload or Back keeps the history entry's state,
 * but arrives as a POP, which doesn't count.
 */
function useHeadingFocusOnNavigation(): void {
  const { pathname, state } = useLocation();
  const retried = useNavigationType() !== NavigationType.Pop && isRetry(state);
  const previous = useRef(retried ? null : pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [pathname]);
}
