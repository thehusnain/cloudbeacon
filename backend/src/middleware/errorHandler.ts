import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('Route not found', 404, 'NOT_FOUND'));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof AppError) {
    res
      .status(error.statusCode)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }

  // Body parser errors contain the submitted body: never expose the original error.
  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
        },
      });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body exceeds the 1mb limit',
        },
      });
      return;
    }
    if (
      error.type === 'encoding.unsupported' ||
      error.type === 'charset.unsupported'
    ) {
      res.status(415).json({
        error: {
          code: 'UNSUPPORTED_ENCODING',
          message: 'Request body encoding is not supported',
        },
      });
      return;
    }
  }

  console.error('Unhandled request error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
