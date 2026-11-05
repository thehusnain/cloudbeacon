import { z } from 'zod';
// HTTP query values must be scalar strings, never arrays or objects.
export function queryInteger(min: number, max: number, fallback: number) {
  return z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional()
    .transform((value) => value ?? fallback);
}
