import type { RouteObject } from 'react-router';
import {
  redirectHome,
  requireSignedIn,
  requireSignedOut,
  settleSession,
} from '@/features/auth/guards';
import { BootScreen } from '@/pages/boot/BootScreen';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { SignInPage } from '@/pages/sign-in/SignInPage';
import { SignUpPage } from '@/pages/sign-up/SignUpPage';
import { welcomeLoader } from '@/pages/welcome/welcome.loader';
import { WelcomePage } from '@/pages/welcome/WelcomePage';
import { ErrorFrame, Frame } from './Frame';

/**
 * Guards are route middleware, not loaders: loaders run in parallel, so a
 * parent loader can't protect its children, while middleware runs top-down
 * before any of them. The root settles the session once; each branch below
 * then only reads it.
 */
export const routes: RouteObject[] = [
  {
    Component: Frame,
    ErrorBoundary: ErrorFrame,
    HydrateFallback: BootScreen,
    middleware: [settleSession],
    children: [
      // Renders nothing: the loader always redirects. Without `element: null`, React Router
      // warns that this leaf route has no element while the first load is pending.
      { index: true, loader: redirectHome, element: null },
      {
        middleware: [requireSignedOut],
        children: [
          { path: 'sign-in', Component: SignInPage },
          { path: 'sign-up', Component: SignUpPage },
        ],
      },
      {
        path: 'app',
        middleware: [requireSignedIn],
        loader: welcomeLoader,
        Component: WelcomePage,
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
];
