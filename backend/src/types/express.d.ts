import type { AuthUser } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
