import { queryInteger } from '../utils/queryInteger.js';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
const id = z.string().regex(/^[a-f0-9]{24}$/i);
const query = z.strictObject({
  serverId: id.optional(),
  status: z.enum(['open', 'closed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  page: queryInteger(1, Number.MAX_SAFE_INTEGER, 1),
  limit: queryInteger(1, 100, 25),
});
export const incidentQuery: RequestHandler = (req, res, next) => {
  const parsed = query.safeParse(req.query);
  if (!parsed.success)
    return next(
      new AppError('Invalid incident filters', 400, 'VALIDATION_ERROR'),
    );
  res.locals.incidentFilters = parsed.data;
  next();
};
export const incidentId: RequestHandler = (req, _res, next) => {
  if (
    !z.strictObject({ id }).safeParse(req.params).success ||
    !z.strictObject({}).safeParse(req.query).success
  )
    return next(
      new AppError('Invalid incident request', 400, 'VALIDATION_ERROR'),
    );
  next();
};
export const incidentPatch = z.strictObject({
  status: z.enum(['open', 'closed']),
});
