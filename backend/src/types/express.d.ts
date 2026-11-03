import type { ServerDocument } from '../models/Server.js';
import type { AuthUser } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      server?: ServerDocument;
    }
  }
}
