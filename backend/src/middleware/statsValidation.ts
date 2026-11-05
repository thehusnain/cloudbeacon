import { queryInteger } from '../utils/queryInteger.js';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
const hoursSchema = z.strictObject({
  hours: queryInteger(1, 168, 24),
});
export const validateStatsHours: RequestHandler = (req, res, next) => {
  const parsed = hoursSchema.safeParse(req.query);
  if (!parsed.success)
    return next(new AppError('Invalid fields: hours', 400, 'VALIDATION_ERROR'));
  res.locals.statsHours = parsed.data.hours;
  next();
};
