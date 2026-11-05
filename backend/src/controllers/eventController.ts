import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { ingestEvents, listEvents } from '../services/eventService.js';
import { recordHeartbeat } from '../services/heartbeatService.js';
export const postEvents: RequestHandler = async (req, res) => {
  if (!req.server)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  res.json(await ingestEvents(req.server.id, req.body.events));
};
export const postHeartbeat: RequestHandler = async (req, res) => {
  if (!req.server)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  res.json(await recordHeartbeat(req.server, req.body));
};
export const getEvents: RequestHandler = async (req, res) => {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  res.json(await listEvents(req.user.id, res.locals.eventFilters));
};
