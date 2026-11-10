import { problemDetailsSchema } from '@nest-react-auth/contracts';
import type { ZodType } from 'zod';
import { ApiError } from './api-error';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
}

const UNREADABLE_ANSWER = 'The server sent an answer we could not read.';

/** Calls the API on this origin and returns the body, checked against `schema`. */
export async function requestJson<T>(
  path: string,
  schema: ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const response = await send(path, options);
  const body = schema.safeParse(await readJson(response));
  if (!body.success) {
    throw new ApiError({
      code: 'UNEXPECTED_RESPONSE',
      status: response.status,
      message: UNREADABLE_ANSWER,
    });
  }
  return body.data;
}

/** For endpoints that answer 204 No Content. */
export async function requestNoContent(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options);
}

async function send(
  path: string,
  { method = 'GET', body, accessToken, signal }: RequestOptions,
): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Sends the httpOnly refresh cookie to the auth routes; it never leaves this origin.
      credentials: 'same-origin',
      signal,
    });
  } catch (error) {
    // A navigation cancels the requests of the page it leaves. That is not a failure to show.
    if (signal?.aborted) throw error;
    throw new ApiError({
      code: 'NETWORK_ERROR',
      status: 0,
      message: 'The server could not be reached.',
    });
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

/** Reads an RFC 9457 problem body; anything else (an HTML 502 from a proxy, say) is unexpected. */
async function toApiError(response: Response): Promise<ApiError> {
  const problem = problemDetailsSchema.safeParse(await readJson(response));
  if (!problem.success) {
    return new ApiError({
      code: 'UNEXPECTED_RESPONSE',
      status: response.status,
      message: UNREADABLE_ANSWER,
    });
  }
  const { code, detail, errors } = problem.data;
  return new ApiError({ code, status: response.status, message: detail, fieldErrors: errors });
}

const readJson = (response: Response): Promise<unknown> => response.json().catch(() => undefined);
