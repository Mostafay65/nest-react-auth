import type { AuthSession, ErrorCode, FieldError, UserProfile } from '@nest-react-auth/contracts';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** Fake API for the tests. Every test declares the endpoints it expects to be called. */
export const server = setupServer();

export const endpoints = {
  signUp: '/api/v1/auth/sign-up',
  signIn: '/api/v1/auth/sign-in',
  refresh: '/api/v1/auth/refresh',
  signOut: '/api/v1/auth/sign-out',
  me: '/api/v1/users/me',
} as const;

export const ada: UserProfile = {
  id: '665f1c2e8b3a4d0012345678',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  createdAt: '2026-03-14T09:30:00.000Z',
};

export const sessionFor = (accessToken: string, user: UserProfile = ada): AuthSession => ({
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  user,
});

/** An RFC 9457 problem response, as the API sends them. */
export const problem = (status: number, code: ErrorCode, detail: string, errors?: FieldError[]) =>
  HttpResponse.json(
    { type: 'about:blank', title: 'Error', status, detail, instance: '/api', code, errors },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

export const expiredToken = () =>
  problem(401, 'UNAUTHORIZED', 'The access token is invalid or has expired.');

/** Ready-made handlers for the common answers. */
export const respond = {
  refreshSignedIn: (accessToken = 'access-1') =>
    http.post(endpoints.refresh, () => HttpResponse.json(sessionFor(accessToken))),

  refreshSignedOut: () =>
    http.post(endpoints.refresh, () =>
      problem(401, 'INVALID_REFRESH_TOKEN', 'Your session has ended. Please sign in again.'),
    ),

  profile: (user: UserProfile = ada) => http.get(endpoints.me, () => HttpResponse.json(user)),

  signOut: () => http.post(endpoints.signOut, () => new HttpResponse(null, { status: 204 })),
};
