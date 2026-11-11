import { useEffect } from 'react';
import { useLocation, useNavigate, useNavigation, useRouteError } from 'react-router';
import { ApiError } from '@/shared/http/api-error';
import { Button } from '@/shared/ui/Button';
import { Spread } from '@/shared/ui/Spread';
import { RETRIED } from './retry';

/**
 * When the server can't answer right now, trying again in a moment is the
 * cure. For anything else (a bug, an answer we can't read) it is a fresh load.
 */
function retryAdvice(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'RATE_LIMITED') {
    return 'Too many requests came from this network. Please wait a minute, then try again.';
  }
  if (error.code === 'NETWORK_ERROR' || error.status >= 500) {
    return "We can't reach the server right now. Please try again in a moment.";
  }
  return null;
}

/** Shown, inside the usual frame, when a page fails to load or render. */
export function RouteErrorPage() {
  const error = useRouteError();
  const advice = retryAdvice(error);

  useEffect(() => {
    // The page tells the user what to do; the console keeps the details for developers.
    console.error(error);
  }, [error]);

  return (
    <Spread
      title="Something went wrong."
      lede={advice ?? 'The page could not be loaded. Reloading usually helps.'}
    >
      <title>Something went wrong · Auth Module</title>
      {advice ? (
        <TryAgainButton />
      ) : (
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
      )}
    </Spread>
  );
}

/** Opens the same page again, which checks the session and loads the page's data anew. */
function TryAgainButton() {
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const trying = useNavigation().state !== 'idle';

  return (
    <Button
      pending={trying}
      onClick={() => void navigate({ pathname, search, hash }, { replace: true, state: RETRIED })}
    >
      {trying ? 'Trying again…' : 'Try again'}
    </Button>
  );
}
