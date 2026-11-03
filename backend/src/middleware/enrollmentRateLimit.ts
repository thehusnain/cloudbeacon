import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function createEnrollmentLimiter() {
  const max = env.ENROLL_RATE_LIMIT_MAX;
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Math.max(max, 1),
    skip: () => max === 0,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new AppError(
          'Too many requests. Please try again later.',
          429,
          'RATE_LIMIT_EXCEEDED',
        ),
      ),
  });
}
