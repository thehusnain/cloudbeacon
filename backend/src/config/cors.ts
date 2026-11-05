import type { CorsOptions } from 'cors';
import { env } from './env.js';
import { AppError } from '../utils/AppError.js';

// CLIENT_URL is validated as a canonical HTTP(S) origin at startup.
// Missing Origin is allowed for agents and other non-browser clients.
export function isAllowedOrigin(origin: string | undefined): boolean {
  return origin === undefined || origin === env.CLIENT_URL;
}
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) callback(null, origin ?? false);
    else callback(new AppError('Origin is not allowed', 403, 'CORS_FORBIDDEN'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
