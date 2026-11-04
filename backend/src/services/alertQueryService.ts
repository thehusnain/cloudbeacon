import { Alert } from '../models/Alert.js';
import { Server } from '../models/Server.js';
import { AppError } from '../utils/AppError.js';
import { emitToServerOwner } from '../realtime/socket.js';

export type AlertFilters = {
  serverId?: string;
  status?: 'open' | 'acknowledged' | 'resolved';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  page: number;
  limit: number;
};
const notFound = () => new AppError('Alert not found', 404, 'NOT_FOUND');

export async function listAlerts(ownerId: string, filters: AlertFilters) {
  const owned = await Server.find({ owner: ownerId }, { _id: 1 }).lean();
  const ids = filters.serverId
    ? owned
        .filter((s) => s._id.toString() === filters.serverId)
        .map((s) => s._id)
    : owned.map((s) => s._id);
  const query: Record<string, unknown> = { serverId: { $in: ids } };
  if (filters.status) query.status = filters.status;
  if (filters.severity) query.severity = filters.severity;
  const [items, total] = await Promise.all([
    Alert.find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
    Alert.countDocuments(query),
  ]);
  return { items, page: filters.page, limit: filters.limit, total };
}

export async function getAlert(ownerId: string, id: string) {
  const owned = await Server.find({ owner: ownerId }, { _id: 1 }).lean();
  const alert = await Alert.findOne({
    _id: id,
    serverId: { $in: owned.map((s) => s._id) },
  }).lean();
  if (!alert) throw notFound();
  return alert;
}

export async function updateAlert(
  ownerId: string,
  id: string,
  status: 'open' | 'acknowledged' | 'resolved',
) {
  const owned = await Server.find({ owner: ownerId }, { _id: 1 }).lean();
  const filter = { _id: id, serverId: { $in: owned.map((s) => s._id) } };
  const previous = await Alert.findOne(filter).select('status').lean();
  const alert = await Alert.findOneAndUpdate(
    filter,
    { $set: { status } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!alert) throw notFound();
  if (previous?.status !== alert.status) {
    await emitToServerOwner(String(alert.serverId), 'alert:updated', {
      id: String(alert._id),
      status: alert.status,
      eventCount: alert.eventIds.length,
    });
  }
  return alert;
}
