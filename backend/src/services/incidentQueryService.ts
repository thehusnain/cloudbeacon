import { Incident } from '../models/Incident.js';
import { Server } from '../models/Server.js';
import { AppError } from '../utils/AppError.js';
export async function getIncident(ownerId: string, id: string) {
  const owned = await Server.find({ owner: ownerId }).select('_id').lean();
  const incident = await Incident.findOne({
    _id: id,
    serverId: { $in: owned.map((s) => s._id) },
  }).lean();
  if (!incident) throw new AppError('Incident not found', 404, 'NOT_FOUND');
  return incident;
}
export async function listIncidents(
  ownerId: string,
  filters: {
    serverId?: string;
    status?: 'open' | 'closed';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    page: number;
    limit: number;
  },
) {
  const owned = await Server.find({ owner: ownerId }).select('_id').lean();
  if (
    filters.serverId &&
    !owned.some((s) => String(s._id) === filters.serverId)
  )
    throw new AppError('Server not found', 404, 'NOT_FOUND');
  const query = {
    serverId: {
      $in: owned
        .filter((s) => !filters.serverId || String(s._id) === filters.serverId)
        .map((s) => s._id),
    },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
  };
  const [items, total] = await Promise.all([
    Incident.find(query)
      .sort({ lastActivityAt: -1, _id: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
    Incident.countDocuments(query),
  ]);
  return { items, total, page: filters.page, limit: filters.limit };
}
export async function updateIncident(
  ownerId: string,
  id: string,
  status: 'open' | 'closed',
) {
  const incident = await getIncident(ownerId, id);
  return Incident.findOneAndUpdate(
    { _id: incident._id, serverId: incident.serverId },
    { $set: { status } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
}
