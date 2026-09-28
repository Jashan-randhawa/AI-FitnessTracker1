import crypto from 'crypto';
import { RequestIdOptions } from './types';

/**
 * Express middleware that assigns a unique request ID to each incoming request,
 * attaches it to req.id and req.requestId, and sets the X-Request-Id header on response.
 */
export const requestId = (options: RequestIdOptions = {}) => {
  const headerName = (options.headerName || 'x-request-id').toLowerCase();
  const generate = options.generator || (() => crypto.randomUUID());

  return (req: any, res: any, next: (err?: any) => void) => {
    const existingId = req.headers?.[headerName];
    const id =
      typeof existingId === 'string' && existingId.trim().length > 0
        ? existingId.trim()
        : generate();

    req.id = id;
    req.requestId = id;
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-Request-Id', id);
    }
    next();
  };
};

export default requestId;
