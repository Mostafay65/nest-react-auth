import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { SignUpInput } from '@nest-react-auth/contracts';
import type { Connection } from 'mongoose';
import request, { type Response } from 'supertest';
import { createApp } from '../../src/app.setup.js';

export const AUTH = '/api/v1/auth';

/** Boots the app through createApp(), exactly like main.ts, without listening on a port. */
export async function startTestApp(): Promise<NestExpressApplication> {
  const app = await createApp({ abortOnError: false });
  await app.init();
  return app;
}

export const databaseOf = (app: INestApplication): Connection =>
  app.get<Connection>(getConnectionToken());

let clients = 0;

/**
 * Sends requests from an IP address of its own (via X-Forwarded-For, trusted
 * in the e2e environment), so per-IP rate limits never carry over between tests.
 */
export function apiClient(app: INestApplication) {
  clients += 1;
  const ip = `10.0.${Math.floor(clients / 250)}.${(clients % 250) + 1}`;
  const server = app.getHttpServer();
  return {
    get: (path: string) => request(server).get(path).set('X-Forwarded-For', ip),
    post: (path: string) => request(server).post(path).set('X-Forwarded-For', ip),
  };
}

export type ApiClient = ReturnType<typeof apiClient>;

/** A valid sign-up body with an email no other test uses. */
export const newUser = (overrides: Partial<SignUpInput> = {}): SignUpInput => ({
  email: `user-${randomUUID()}@example.com`,
  name: 'Ada Lovelace',
  password: 'Analytical1!',
  ...overrides,
});

export interface SetCookie {
  value: string;
  /** Attribute names are lower-cased; flags such as HttpOnly map to `true`. */
  attributes: Record<string, string | true>;
}

/** Reads one cookie from the response's Set-Cookie headers. */
export function readCookie(response: Response, name = 'refresh_token'): SetCookie | undefined {
  for (const header of response.get('Set-Cookie') ?? []) {
    const [pair = '', ...parts] = header.split(';').map((part) => part.trim());
    const separator = pair.indexOf('=');
    if (pair.slice(0, separator) !== name) continue;

    const attributes = Object.fromEntries(
      parts.map((part) => {
        const [key = '', value] = part.split('=');
        return [key.toLowerCase(), value ?? true];
      }),
    );
    return { value: pair.slice(separator + 1), attributes };
  }
  return undefined;
}

/** The value of the refresh cookie a response set; fails the test if there is none. */
export function refreshTokenFrom(response: Response): string {
  const cookie = readCookie(response);
  if (!cookie?.value) throw new Error(`Expected a refresh_token cookie, got: ${response.text}`);
  return cookie.value;
}

export const refreshCookie = (token: string): string => `refresh_token=${token}`;

/** Signs up a fresh user and returns what a client would keep from the response. */
export async function signUp(client: ApiClient, overrides: Partial<SignUpInput> = {}) {
  const body = newUser(overrides);
  const response = await client.post(`${AUTH}/sign-up`).send(body).expect(201);
  return {
    body,
    userId: response.body.user.id as string,
    accessToken: response.body.accessToken as string,
    refreshToken: refreshTokenFrom(response),
  };
}
