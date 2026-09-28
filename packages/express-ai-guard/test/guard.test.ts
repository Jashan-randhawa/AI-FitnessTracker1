import { describe, it, expect, vi } from 'vitest';
import {
  requestId,
  errorHandler,
  sendError,
  aiLimiters,
  authLimiter,
  passwordResetLimiter,
} from '../src/index';

const createMockRes = () => {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    body: null,
    headers,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, val: string) {
      this.headers[name] = val;
    },
  };
  return res;
};

describe('express-ai-guard', () => {
  describe('sendError', () => {
    it('sets both flat and nested message', () => {
      const res = createMockRes();
      sendError(res, 400, 'Test error message', { code: 'CUSTOM' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Test error message');
      expect(res.body.error.message).toBe('Test error message');
      expect(res.body.error.code).toBe('CUSTOM');
    });
  });

  describe('requestId', () => {
    it('generates a UUID when X-Request-Id is missing', () => {
      const middleware = requestId();
      const req: any = { headers: {} };
      const res = createMockRes();
      let nextCalled = false;

      middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.id).toBeDefined();
      expect(req.requestId).toBe(req.id);
      expect(res.headers['X-Request-Id']).toBe(req.id);
    });

    it('preserves incoming X-Request-Id', () => {
      const middleware = requestId();
      const req: any = { headers: { 'x-request-id': 'custom-id-12345' } };
      const res = createMockRes();

      middleware(req, res, () => {});

      expect(req.id).toBe('custom-id-12345');
      expect(req.requestId).toBe('custom-id-12345');
      expect(res.headers['X-Request-Id']).toBe('custom-id-12345');
    });
  });

  describe('errorHandler', () => {
    const handler = errorHandler({ isProduction: true });

    it('returns 400 for MulterError', () => {
      const err = { name: 'MulterError', message: 'File too large' };
      const res = createMockRes();
      handler(err, {}, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toBe('File too large');
    });

    it('returns 400 for ValidationError', () => {
      const err = {
        name: 'ValidationError',
        errors: {
          email: { message: 'Email is required' },
          age: { message: 'Age must be positive' },
        },
      };
      const res = createMockRes();
      handler(err, {}, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toContain('Email is required');
    });

    it('returns 400 for CastError', () => {
      const err = { name: 'CastError' };
      const res = createMockRes();
      handler(err, {}, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toBe('Invalid resource identifier.');
    });

    it('returns 400 for code 11000 duplicate key error', () => {
      const err = { code: 11000, keyPattern: { username: 1 } };
      const res = createMockRes();
      handler(err, {}, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toBe('username is already taken.');
    });

    it('masks internal server errors in production', () => {
      const err = new Error('Database password leak');
      const res = createMockRes();
      handler(err, {}, res, () => {});

      expect(res.statusCode).toBe(500);
      expect(res.body.error.message).toBe('Internal server error. Please try again later.');
    });

    it('masks MongoServerError even if staged status was 4xx', () => {
      const err = { name: 'MongoServerError', message: 'Topology destroyed' };
      const res = createMockRes();
      res.statusCode = 400;
      handler(err, {}, res, () => {});

      expect(res.body.error.message).toBe('Internal server error. Please try again later.');
    });

    it('preserves friendly 503 messages on operational upstream errors', () => {
      const err = {
        status: 503,
        isOperational: true,
        message: 'AI assistant is temporarily down for maintenance.',
      };
      const res = createMockRes();
      handler(err, {}, res, () => {});

      expect(res.statusCode).toBe(503);
      expect(res.body.error.message).toBe('AI assistant is temporarily down for maintenance.');
    });

    it('calls injected logger on error', () => {
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      const customHandler = errorHandler({ logger, isProduction: false });
      const err = new Error('Some error');
      const req = { id: 'req-1', method: 'GET', originalUrl: '/test' };
      const res = createMockRes();

      customHandler(err, req, res, () => {});

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('rate limiters factory', () => {
    it('creates aiLimiters array with perIp and perUser limiters', () => {
      const limiters = aiLimiters({ perIp: 40, perUser: 25 });
      expect(Array.isArray(limiters)).toBe(true);
      expect(limiters.length).toBe(2);
      expect(typeof limiters.ipLimiter).toBe('function');
      expect(typeof limiters.userLimiter).toBe('function');
    });

    it('creates authLimiter and passwordResetLimiter functions', () => {
      const auth = authLimiter();
      const pw = passwordResetLimiter();
      expect(typeof auth).toBe('function');
      expect(typeof pw).toBe('function');
    });
  });
});
