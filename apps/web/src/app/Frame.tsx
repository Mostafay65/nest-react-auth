import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { useSession } from '@/features/auth/use-session';
import { paths } from '@/shared/paths';
import { type IndexEntry, Masthead } from '@/shared/ui/Masthead';
import styles from './Frame.module.css';

const GUEST_INDEX: readonly IndexEntry[] = [
  { number: '01', label: 'Sign in', to: paths.signIn },
  { number: '02', label: 'Create account', to: paths.signUp },
];

const MEMBER_INDEX: readonly IndexEntry[] = [{ number: '03', label: 'Application', to: paths.app }];

/** Every page sits in this frame: skip link, masthead, the page, colophon. */
export function Frame() {
  const session = useSession();
  useHeadingFocusOnNavigation();

  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <Masthead entries={session.status === 'signed-in' ? MEMBER_INDEX : GUEST_INDEX} />
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.colophon}>
        <span>NestJS · MongoDB · React</span>
        <span>Set in Fraunces &amp; IBM Plex Mono</span>
      </footer>
      <ScrollRestoration />
    </>
  );
}

/**
 * Client-side navigation keeps focus on the link or button that was used, so
 * screen reader users would not hear that the page changed. Moving focus to
 * the new page's heading announces it. The first page load is left alone.
 */
function useHeadingFocusOnNavigation(): void {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [pathname]);
}
