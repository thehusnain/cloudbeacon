import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

const tokenSchema = z.strictObject({ token: z.string().min(1).max(4096) });
const paramsSchema = z.strictObject({ token: z.string().min(1).max(4096) });
const emptySchema = z.strictObject({});

function invalid(next: (error?: unknown) => void): void {
  next(new AppError('Invalid device token fields', 400, 'VALIDATION_ERROR'));
}

export const validateDeviceToken: RequestHandler = (req, _res, next) => {
  const body = tokenSchema.safeParse(req.body);
  if (!body.success) return invalid(next);
  const query = emptySchema.safeParse(req.query);
  if (!query.success) return invalid(next);
  req.body = body.data;
  next();
};

export const validateDeviceTokenParam: RequestHandler = (req, _res, next) => {
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return invalid(next);
  const query = emptySchema.safeParse(req.query);
  if (!query.success) return invalid(next);
  req.params = params.data;
  next();
};
