import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

export const createServerSchema = z.strictObject({
  name: z.string().trim().min(2).max(60),
});
export const enrollmentSchema = z.strictObject({
  key: z.string().min(1).max(256),
  hostname: z.string().trim().min(1).max(253),
  os: z.string().trim().min(1).max(200),
  ip: z.union([z.ipv4(), z.ipv6()]),
  agentVersion: z.string().trim().min(1).max(100),
});
const idSchema = z.strictObject({ id: z.string().regex(/^[a-f0-9]{24}$/i) });
const empty = z.strictObject({});

export const validateServerId: RequestHandler = (req, _res, next) => {
  if (!idSchema.safeParse(req.params).success)
    throw new AppError('Invalid fields: id', 400, 'VALIDATION_ERROR');
  next();
};

export const validateEmptyQuery: RequestHandler = (req, _res, next) => {
  if (!empty.safeParse(req.query).success)
    throw new AppError('Invalid fields: query', 400, 'VALIDATION_ERROR');
  next();
};

export const validateEmptyBody: RequestHandler = (req, _res, next) => {
  if (req.body !== undefined && !empty.safeParse(req.body).success)
    throw new AppError('Invalid fields: body', 400, 'VALIDATION_ERROR');
  next();
};
