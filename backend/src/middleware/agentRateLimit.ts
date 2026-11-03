import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
export function createAgentLimiter() {
  return rateLimit({ windowMs: 15 * 60 * 1000, limit: env.AGENT_RATE_LIMIT_MAX, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req, _res, next) => next(new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')) });
}
