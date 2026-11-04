import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import * as service from '../services/incidentQueryService.js';
import { buildSummary } from '../services/summaryService.js';
import { buildTimeline } from '../services/timelineService.js';
function owner(req: Parameters<RequestHandler>[0]) {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}
export const list: RequestHandler = async (req, res) => {
  res.json(await service.listIncidents(owner(req), res.locals.incidentFilters));
};
export const get: RequestHandler = async (req, res) => {
  const incident = await service.getIncident(
    owner(req),
    req.params.id as string,
  );
  res.json({
    incident: { ...incident, summary: await buildSummary(incident) },
  });
};
export const timeline: RequestHandler = async (req, res) => {
  const incident = await service.getIncident(
    owner(req),
    req.params.id as string,
  );
  res.json({ steps: await buildTimeline(incident) });
};
export const patch: RequestHandler = async (req, res) => {
  res.json({
    incident: await service.updateIncident(
      owner(req),
      req.params.id as string,
      req.body.status,
    ),
  });
};
