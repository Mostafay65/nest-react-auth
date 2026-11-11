import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { followOtherTab } from './session';
import { onAnnouncement } from './session-channel';

/**
 * Keeps this tab in step when the user signs in or out in another one. The
 * page is then opened again, in place, so the route guards decide where the
 * tab belongs: the welcome page moves to sign-in, sign-in moves to the app.
 */
export function useFollowOtherTabs(): void {
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  useEffect(
    () =>
      onAnnouncement((event) => {
        if (followOtherTab(event)) void navigate({ pathname, search, hash }, { replace: true });
      }),
    [navigate, pathname, search, hash],
  );
}
