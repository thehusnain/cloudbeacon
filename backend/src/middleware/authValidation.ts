import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

const email = z.string().trim().toLowerCase().pipe(z.email());
const password = z
  .string()
  .min(8)
  .max(72)
  .regex(/[a-zA-Z]/)
  .regex(/[0-9]/)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72);

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(60),
  email,
  password,
});
export const loginSchema = z.strictObject({ email, password });

export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = [
        ...new Set(
          result.error.issues.map((issue) => String(issue.path[0] ?? 'body')),
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
    req.body = result.data;
    next();
  };
}
