import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/app/routes';

/**
 * Renders the real routes at `path`, in StrictMode like the app, with a user
 * to drive them. `earlierPages` fill the history before it, for tests of Back.
 */
export function renderApp(path: string, earlierPages: readonly string[] = []) {
  const router = createMemoryRouter(routes, { initialEntries: [...earlierPages, path] });
  const user = userEvent.setup();
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  return { router, user };
}
