import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** A caller's request ID is reused only if it is short and safe to print in logs. */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * Registered before every other middleware, so each response carries an ID
 * that also appears in the logs and in error bodies. That includes requests
 * rejected before routing, such as a body that is not valid JSON.
 */
export function assignRequestId(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.get(REQUEST_ID_HEADER);
  const id = incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  request.id = id;
  response.setHeader(REQUEST_ID_HEADER, id);
  next();
}
