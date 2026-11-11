import { delay, http, HttpResponse } from 'msw';
import { z } from 'zod';
import { server } from '@/test/api';
import { requestJson } from './request';

const ENDPOINT = '/api/v1/example';
const anyObject = z.object({});

const neverAnswers = () =>
  http.get(ENDPOINT, async () => {
    await delay('infinite');
    return HttpResponse.json({});
  });

describe('requestJson', () => {
  it('gives up on a server that takes too long to answer', async () => {
    server.use(neverAnswers());

    await expect(requestJson(ENDPOINT, anyObject, { timeoutMs: 20 })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'NETWORK_ERROR',
      status: 0,
      message: 'The server took too long to answer.',
    });
  });

  it('waits ten seconds for an answer unless told otherwise', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    server.use(http.get(ENDPOINT, () => HttpResponse.json({})));

    await requestJson(ENDPOINT, anyObject);

    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  it('passes a cancellation by the caller on as it is, not as a failure', async () => {
    server.use(neverAnswers());
    const controller = new AbortController();

    const request = requestJson(ENDPOINT, anyObject, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('still gives up in time when the caller passes a signal of its own', async () => {
    server.use(neverAnswers());

    const request = requestJson(ENDPOINT, anyObject, {
      signal: new AbortController().signal,
      timeoutMs: 20,
    });

    await expect(request).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'The server took too long to answer.',
    });
  });

  // The build targets Safari 16.4, Chrome 111 and Firefox 114; AbortSignal.any
  // arrived in Safari 17.4, Chrome 116 and Firefox 124.
  it('works in supported browsers that have no AbortSignal.any', async () => {
    vi.spyOn(AbortSignal, 'any').mockImplementation(() => {
      throw new TypeError('AbortSignal.any is not a function');
    });
    server.use(http.get(ENDPOINT, () => HttpResponse.json({})));

    const request = requestJson(ENDPOINT, anyObject, { signal: new AbortController().signal });

    await expect(request).resolves.toEqual({});
  });

  it('reads an error page from a proxy, which is not problem details, as an unexpected answer', async () => {
    server.use(
      http.get(ENDPOINT, () => HttpResponse.html('<h1>502 Bad Gateway</h1>', { status: 502 })),
    );

    await expect(requestJson(ENDPOINT, anyObject)).rejects.toMatchObject({
      code: 'UNEXPECTED_RESPONSE',
      status: 502,
      message: 'The server sent an answer we could not read.',
    });
  });

  it('reports a server that cannot be reached', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.error()));

    await expect(requestJson(ENDPOINT, anyObject)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'The server could not be reached.',
    });
  });
});
