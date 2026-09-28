import { ErrorHandlerOptions } from './types';
import { sendError } from './sendError';

export const notFound = (req: any, res: any) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

/**
 * Creates an Express error handler middleware with safe error masking for production.
 */
export const errorHandler = (options: ErrorHandlerOptions = {}) => {
  const {
    logger,
    isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production',
    genericErrorMessage = 'Internal server error. Please try again later.',
  } = options;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: any, req: any, res: any, next: (err?: any) => void) => {
    // 1. Whitelisted client-facing error types
    if (err && err.name === 'MulterError') {
      return sendError(res, 400, err.message);
    }
    if (err && err.name === 'ValidationError' && err.errors) {
      const message = Object.values(err.errors)
        .map((e: any) => e.message)
        .join(', ');
      return sendError(res, 400, message);
    }
    if (err && err.name === 'CastError') {
      return sendError(res, 400, 'Invalid resource identifier.');
    }
    if (err && (err.code === 11000 || err.code === '11000')) {
      const field = Object.keys(err.keyPattern || { field: 1 })[0];
      return sendError(res, 400, `${field} is already taken.`);
    }

    // 2. Log unhandled application errors
    const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    if (logger) {
      logger.error('Unhandled application error', {
        requestId: req?.id || req?.requestId,
        method: req?.method,
        url: req?.originalUrl,
        errorName: err?.name,
        errorMessage: err?.message,
        stack: err?.stack,
      });
    } else if (!isTest) {
      console.error('Unhandled application error', {
        requestId: req?.id || req?.requestId,
        method: req?.method,
        url: req?.originalUrl,
        errorName: err?.name,
        errorMessage: err?.message,
        stack: err?.stack,
      });
    }

    const status =
      err?.status ||
      (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

    const isInternalDbError =
      err &&
      (err.name === 'MongoError' ||
        err.name === 'MongoServerError' ||
        err.name === 'MongooseError');

    const isProd =
      options.isProduction !== undefined
        ? options.isProduction
        : typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';

    let message: string;
    if (isProd) {
      if (status >= 500 || isInternalDbError) {
        // Upstream operational outages (e.g. AI provider 503) can keep friendly message
        if (err?.isOperational && err?.message && !isInternalDbError) {
          message = err.message;
        } else {
          message = genericErrorMessage;
        }
      } else {
        message =
          err?.isOperational || (status >= 400 && status < 500 && !isInternalDbError)
            ? err?.message || 'Invalid request.'
            : 'An error occurred processing your request.';
      }
    } else {
      message = err?.message || 'Something went wrong. Please try again.';
    }

    sendError(res, status, message);
  };
};

export default errorHandler;
