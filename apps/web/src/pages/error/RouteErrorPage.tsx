import { isRouteErrorResponse, useRouteError } from 'react-router';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { Button } from '@/shared/ui/Button';
import { Masthead } from '@/shared/ui/Masthead';
import { Spread } from '@/shared/ui/Spread';

/** Shown when a page fails to load or render. It replaces the frame, so it brings its own masthead. */
export function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <>
      <Masthead />
      <main id="main">
        {notFound ? (
          <NotFoundPage />
        ) : (
          <Spread
            index="500"
            title="Something went wrong."
            lede="The page could not be loaded. Reloading usually helps."
          >
            <title>Something went wrong · Auth Module</title>
            <Button onClick={() => window.location.reload()}>Reload the page</Button>
          </Spread>
        )}
      </main>
    </>
  );
}
