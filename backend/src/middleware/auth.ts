import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, toAuthUser } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

function unauthorized() {
  return new AppError('Authentication required', 401, 'UNAUTHORIZED');
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') ?? '');
  if (!match) throw unauthorized();

  let userId: string;
  try {
    const payload = jwt.verify(match[1], env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(payload.sub) ||
      typeof payload.exp !== 'number'
    ) {
      throw unauthorized();
    }
    userId = payload.sub;
  } catch {
    throw unauthorized();
  }

  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  req.user = toAuthUser(user);
  next();
};
