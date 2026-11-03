import type { Request, RequestHandler } from 'express';
import * as service from '../services/serverService.js';
import { AppError } from '../utils/AppError.js';

function ownerId(req: Request): string {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}

export const createServer: RequestHandler = async (req, res) => {
  res.status(201).json(await service.createServer(ownerId(req), req.body.name));
};
export const listServers: RequestHandler = async (req, res) => {
  res.json({ servers: await service.listServers(ownerId(req)) });
};
export const getServer: RequestHandler = async (req, res) => {
  res.json({
    server: await service.getServer(ownerId(req), req.params.id as string),
  });
};
export const deleteServer: RequestHandler = async (req, res) => {
  await service.deleteServer(ownerId(req), req.params.id as string);
  res.sendStatus(204);
};
export const enrollAgent: RequestHandler = async (req, res) => {
  res.status(201).json(await service.enrollAgent(req.body));
};
