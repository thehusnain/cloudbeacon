import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { getOverview, getEventsOverTime } from '../services/statsService.js';
function owner(req: Parameters<RequestHandler>[0]) {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}
export const overview: RequestHandler = async (req, res) => {
  res.json(await getOverview(owner(req)));
};
export const eventsOverTime: RequestHandler = async (req, res) => {
  res.json(await getEventsOverTime(owner(req), res.locals.statsHours));
};
