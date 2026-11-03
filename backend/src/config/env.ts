import { z } from 'zod';

const envSchema = z.object({
  ENROLL_RATE_LIMIT_MAX: z.coerce.number().int().min(0).default(10),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(0).default(10),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGO_URI: z
    .string()
    .trim()
    .min(1)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          ['mongodb:', 'mongodb+srv:'].includes(url.protocol) &&
          Boolean(url.hostname)
        );
      } catch {
        return false;
      }
    }, 'Must be a MongoDB connection URI'),
  JWT_SECRET: z.string().trim().min(32),
  CLIENT_URL: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    } catch {
      return false;
    }
  }, 'Must be an HTTP(S) origin without a path or trailing slash'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
