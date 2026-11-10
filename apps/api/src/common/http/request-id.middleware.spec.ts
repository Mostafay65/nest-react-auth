import type { Request, Response } from 'express';
import { assignRequestId } from './request-id.middleware.js';

function run(incoming?: string) {
  const request = { get: () => incoming } as unknown as Request;
  const setHeader = vi.fn();
  const next = vi.fn();

  assignRequestId(request, { setHeader } as unknown as Response, next);

  return { id: request.id, setHeader, next };
}

describe('assignRequestId', () => {
  it('gives a request without an ID a fresh UUID and echoes it back', () => {
    const { id, setHeader, next } = run();

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', id);
    expect(next).toHaveBeenCalledOnce();
  });

  it("keeps a caller's ID, so one ID can follow a request across services", () => {
    expect(run('checkout-7f3a.retry:2').id).toBe('checkout-7f3a.retry:2');
  });

  it.each([
    ['contains spaces', 'id with spaces'],
    ['could forge a log line', 'abc\n{"level":"error"}'],
    ['is longer than 128 characters', 'a'.repeat(129)],
    ['is empty', ''],
  ])('replaces an ID that %s', (_label, incoming) => {
    const { id } = run(incoming);

    expect(id).not.toBe(incoming);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
