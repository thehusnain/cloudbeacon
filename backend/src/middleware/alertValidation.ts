import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

const querySchema = z
  .object({
    serverId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
const paramsSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i) });
const patchSchema = z.strictObject({
  status: z.enum(['open', 'acknowledged', 'resolved']),
});
export const validateAlertQuery: RequestHandler = (req, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new AppError('Invalid alert filters', 400, 'VALIDATION_ERROR'));
    return;
  }
  res.locals.alertFilters = parsed.data;
  next();
};
export const validateAlertId: RequestHandler = (req, _res, next) => {
  if (!paramsSchema.safeParse(req.params).success) {
    next(new AppError('Invalid fields: id', 400, 'VALIDATION_ERROR'));
    return;
  }
  next();
};
export const validateAlertPatch: RequestHandler = (req, _res, next) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new AppError('Invalid fields: status', 400, 'VALIDATION_ERROR'));
    return;
  }
  req.body = parsed.data;
  next();
};
