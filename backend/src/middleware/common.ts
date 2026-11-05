import { responseSafety } from './responseSafety.js';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { requestLogger } from './requestLogger.js';

export function applyCommonMiddleware(app: Express): void {
  app.use(requestLogger);
  app.use(responseSafety);
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      skip: (req) =>
        req.path === '/api/agent' || req.path.startsWith('/api/agent/'),
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
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === env.CLIENT_URL) {
          callback(null, true);
          return;
        }
        callback(new AppError('Origin is not allowed', 403, 'CORS_FORBIDDEN'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
}
