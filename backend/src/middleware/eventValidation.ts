import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { eventBatchSchema, eventsQuerySchema } from '../utils/eventSchema.js';
import { z } from 'zod';
export const validateEventBatch: RequestHandler = (req, _res, next) => {
  const parsed = eventBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new AppError('Invalid fields: events', 400, 'VALIDATION_ERROR'));
    return;
  }
  req.body = parsed.data;
  next();
};
export const heartbeatSchema = z
  .object({
    timestamp: z.iso.datetime({ offset: true }),
    agentVersion: z.string().min(1).max(100),
    stats: z
      .object({
        cpuPercent: z.number().min(0).max(100),
        memoryMb: z.number().nonnegative(),
        bufferedEvents: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export const validateHeartbeat: RequestHandler = (req, _res, next) => {
  const parsed = heartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new AppError('Invalid fields: heartbeat', 400, 'VALIDATION_ERROR'));
    return;
  }
  req.body = parsed.data;
  next();
};
export const validateEventQuery: RequestHandler = (req, res, next) => {
  const parsed = eventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new AppError('Invalid event filters', 400, 'VALIDATION_ERROR'));
    return;
  }
  res.locals.eventFilters = parsed.data;
  next();
};
