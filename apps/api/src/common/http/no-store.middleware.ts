import type { NextFunction, Request, Response } from 'express';

/**
 * API responses carry tokens and personal data, so no browser or proxy may
 * keep a copy, not even after the user signs out (OWASP: sensitive responses
 * get `no-store`).
 */
export function preventCaching(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}
