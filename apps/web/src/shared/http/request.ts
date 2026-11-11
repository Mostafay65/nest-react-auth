import { problemDetailsSchema } from '@nest-react-auth/contracts';
import type { ZodType } from 'zod';
import { ApiError } from './api-error';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
  /** How long to wait for an answer before giving up. */
  timeoutMs?: number;
}

/** Without a limit, a server that never answers would leave a form waiting forever. */
const DEFAULT_TIMEOUT_MS = 10_000;

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
  { method = 'GET', body, accessToken, signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions,
): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const timeout = AbortSignal.timeout(timeoutMs);

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Sends the httpOnly refresh cookie to the auth routes; it never leaves this origin.
      credentials: 'same-origin',
      // Whichever comes first: the caller cancelling, or the time limit.
      signal: signal ? whicheverAbortsFirst(signal, timeout) : timeout,
    });
  } catch (error) {
    // A navigation cancels the requests of the page it leaves. That is not a failure to show.
    if (signal?.aborted) throw error;
    throw new ApiError({
      code: 'NETWORK_ERROR',
      status: 0,
      message: timeout.aborted
        ? 'The server took too long to answer.'
        : 'The server could not be reached.',
    });
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

/**
 * Aborts as soon as either signal does. `AbortSignal.any` does the same, but it
 * is newer than some browsers this app is built for (Safari 16.4, Chrome 111,
 * Firefox 114), where calling it would make every such request fail.
 */
function whicheverAbortsFirst(first: AbortSignal, second: AbortSignal): AbortSignal {
  const controller = new AbortController();
  for (const signal of [first, second]) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
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
