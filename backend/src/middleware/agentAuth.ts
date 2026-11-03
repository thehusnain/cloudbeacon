import type { RequestHandler } from 'express';
import { Server } from '../models/Server.js';
import { sha256 } from '../utils/crypto.js';
import { AppError } from '../utils/AppError.js';

export const agentAuth: RequestHandler = async (req, _res, next) => {
  const token = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') ?? '')?.[1];
  if (!token)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  const server = await Server.findOne({ agentTokenHash: sha256(token) });
  if (!server)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  req.server = server;
  next();
};
