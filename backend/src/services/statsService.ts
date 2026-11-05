import { Types } from 'mongoose';
import { Server } from '../models/Server.js';
import { Alert } from '../models/Alert.js';
import { Incident } from '../models/Incident.js';
import { Event } from '../models/Event.js';

async function ownedServers(ownerId: string) {
  return Server.find({ owner: ownerId }).select('_id status').lean();
}
export async function getOverview(ownerId: string, now = new Date()) {
  const servers = await ownedServers(ownerId);
  const ids = servers.map((server) => server._id);
  const [alerts, incidents, events, serverCounts] = await Promise.all([
    Alert.aggregate<{ _id: string; count: number }>([
      { $match: { serverId: { $in: ids }, status: 'open' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    Incident.aggregate<{ count: number }>([
      { $match: { serverId: { $in: ids }, status: 'open' } },
      { $count: 'count' },
    ]),
    Event.aggregate<{ count: number }>([
      {
        $match: {
          serverId: { $in: ids },
          timestamp: {
            $gte: new Date(now.getTime() - 24 * 3600000),
            $lte: now,
          },
        },
      },
      { $count: 'count' },
    ]),
    Server.aggregate<{ _id: string; count: number }>([
      { $match: { owner: new Types.ObjectId(ownerId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const alert of alerts)
    if (alert._id in bySeverity)
      bySeverity[alert._id as keyof typeof bySeverity] = alert.count;
  return {
    servers: {
      total: servers.length,
      online: serverCounts.find((s) => s._id === 'online')?.count ?? 0,
      offline: serverCounts.find((s) => s._id === 'offline')?.count ?? 0,
      pending: serverCounts.find((s) => s._id === 'pending')?.count ?? 0,
    },
    alerts: { open: alerts.reduce((sum, a) => sum + a.count, 0), bySeverity },
    incidents: { open: incidents[0]?.count ?? 0 },
    events: { last24h: events[0]?.count ?? 0 },
  };
}
export async function getEventsOverTime(
  ownerId: string,
  hours: number,
  now = new Date(),
) {
  const ids = (await ownedServers(ownerId)).map((server) => server._id);
  const currentHour = Math.floor(now.getTime() / 3600000) * 3600000;
  const firstHour = currentHour - (hours - 1) * 3600000;
  const rows = await Event.aggregate<{ _id: Date; count: number }>([
    {
      $match: {
        serverId: { $in: ids },
        timestamp: { $gte: new Date(firstHour), $lte: now },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: { date: '$timestamp', unit: 'hour', timezone: 'UTC' },
        },
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = new Map(rows.map((row) => [row._id.getTime(), row.count]));
  return {
    buckets: Array.from({ length: hours }, (_, index) => {
      const start = firstHour + index * 3600000;
      return {
        start: new Date(start).toISOString(),
        count: counts.get(start) ?? 0,
      };
    }),
  };
}
