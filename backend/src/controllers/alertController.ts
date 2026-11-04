import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import {
  getAlert,
  listAlerts,
  updateAlert,
} from '../services/alertQueryService.js';
function ownerId(req: Parameters<RequestHandler>[0]): string {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}
export const list: RequestHandler = async (req, res) =>
  res.json(await listAlerts(ownerId(req), res.locals.alertFilters));
export const get: RequestHandler = async (req, res) =>
  res.json({ alert: await getAlert(ownerId(req), req.params.id as string) });
export const patch: RequestHandler = async (req, res) =>
  res.json({
    alert: await updateAlert(
      ownerId(req),
      req.params.id as string,
      req.body.status,
    ),
  });
