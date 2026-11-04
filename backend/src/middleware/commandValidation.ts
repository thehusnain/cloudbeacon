import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ipAddressSchema } from '../utils/eventSchema.js';
import { AppError } from '../utils/AppError.js';

const paramsSchema = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{24}$/i),
});
const commandParamsSchema = z.strictObject({
  commandId: z.string().regex(/^[a-f0-9]{24}$/i),
});
const blockSchema = z.strictObject({
  ip: ipAddressSchema,
  durationSeconds: z.number().int().min(1).max(604800).optional(),
});
const unblockSchema = z.strictObject({ ip: ipAddressSchema });
const querySchema = z.strictObject({
  status: z.enum(['pending', 'delivered', 'done', 'failed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const resultSchema = z.strictObject({
  status: z.enum(['done', 'failed']),
  message: z.string().max(2000).optional(),
  timestamp: z.iso.datetime({ offset: true }).optional(),
});

function validate<T>(
  schema: z.ZodType<T>,
  value: unknown,
  assign: (data: T) => void,
  next: (error?: unknown) => void,
) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const fields = [
      ...new Set(
        parsed.error.issues.map((issue) => String(issue.path[0] ?? 'request')),
      ),
    ];
    next(
      new AppError(
        `Invalid fields: ${fields.join(', ')}`,
        400,
        'VALIDATION_ERROR',
      ),
    );
    return;
  }
  assign(parsed.data);
  next();
}

export const validateCommandServerId: RequestHandler = (req, _res, next) =>
  validate(
    paramsSchema,
    req.params,
    (data) => {
      req.params = data;
    },
    next,
  );
export const validateCommandId: RequestHandler = (req, _res, next) =>
  validate(
    commandParamsSchema,
    req.params,
    (data) => {
      req.params = data;
    },
    next,
  );
export const validateBlockCommand: RequestHandler = (req, _res, next) =>
  validate(
    blockSchema,
    req.body,
    (data) => {
      req.body = data;
    },
    next,
  );
export const validateUnblockCommand: RequestHandler = (req, _res, next) =>
  validate(
    unblockSchema,
    req.body,
    (data) => {
      req.body = data;
    },
    next,
  );
export const validateCommandQuery: RequestHandler = (req, res, next) =>
  validate(
    querySchema,
    req.query,
    (data) => {
      res.locals.commandFilters = data;
    },
    next,
  );
export const validateCommandResult: RequestHandler = (req, _res, next) =>
  validate(
    resultSchema,
    req.body,
    (data) => {
      req.body = data;
    },
    next,
  );
