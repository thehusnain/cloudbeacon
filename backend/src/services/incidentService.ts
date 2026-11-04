import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { Incident } from '../models/Incident.js';
import { Alert } from '../models/Alert.js';
import { Event } from '../models/Event.js';
const levels = ['low', 'medium', 'high', 'critical'] as const;
type Severity = (typeof levels)[number];
export function highestSeverity(a: Severity, b: Severity): Severity {
  return levels[Math.max(levels.indexOf(a), levels.indexOf(b))];
}
export function incidentMatches(
  incident: {
    serverId: unknown;
    status: string;
    sourceIps: string[];
    lastActivityAt: Date;
  },
  serverId: string,
  sourceIp: string | undefined,
  at: Date,
  windowMinutes = 30,
): boolean {
  return (
    String(incident.serverId) === serverId &&
    incident.status === 'open' &&
    ((!!sourceIp && incident.sourceIps.includes(sourceIp)) ||
      Math.abs(at.getTime() - incident.lastActivityAt.getTime()) <=
        windowMinutes * 60000)
  );
}
export async function attachAlertToIncident(alert: {
  _id: Types.ObjectId;
  serverId: Types.ObjectId;
  incidentId?: Types.ObjectId | null;
  sourceIp?: string | null;
  severity: Severity;
  title: string;
  eventIds: Types.ObjectId[];
  createdAt: Date;
}): Promise<void> {
  try {
    const events = await Event.find({
      _id: { $in: alert.eventIds },
      serverId: alert.serverId,
    })
      .select('timestamp')
      .lean();
    const times = events.length
      ? events.map((e) => e.timestamp.getTime())
      : [alert.createdAt.getTime()];
    const earliest = new Date(Math.min(...times));
    const latest = new Date(Math.max(...times));
    let incident = alert.incidentId
      ? await Incident.findOne({
          _id: alert.incidentId,
          serverId: alert.serverId,
          status: 'open',
        })
      : null;
    if (!incident) {
      const candidates = await Incident.find({
        serverId: alert.serverId,
        status: 'open',
        $or: [
          ...(alert.sourceIp ? [{ sourceIps: alert.sourceIp }] : []),
          {
            lastActivityAt: {
              $gte: new Date(
                latest.getTime() - env.INCIDENT_WINDOW_MINUTES * 60000,
              ),
              $lte: new Date(
                latest.getTime() + env.INCIDENT_WINDOW_MINUTES * 60000,
              ),
            },
          },
        ],
      }).sort({ lastActivityAt: -1 });
      incident =
        candidates.find((i) =>
          incidentMatches(
            i,
            String(alert.serverId),
            alert.sourceIp ?? undefined,
            latest,
            env.INCIDENT_WINDOW_MINUTES,
          ),
        ) ?? null;
    }
    if (!incident)
      incident = await Incident.create({
        serverId: alert.serverId,
        title: alert.title,
        severity: alert.severity,
        startedAt: earliest,
        lastActivityAt: latest,
      });
    await Incident.updateOne(
      { _id: incident._id, serverId: alert.serverId },
      {
        $addToSet: {
          alertIds: alert._id,
          eventIds: { $each: alert.eventIds },
          ...(alert.sourceIp ? { sourceIps: alert.sourceIp } : {}),
        },
        $min: { startedAt: earliest },
        $max: { lastActivityAt: latest },
      },
    );
    // Conditional promotion prevents concurrent lower-severity alerts from downgrading an incident.
    await Incident.updateOne(
      {
        _id: incident._id,
        severity: { $in: levels.slice(0, levels.indexOf(alert.severity)) },
      },
      { $set: { severity: alert.severity } },
    );
    await Alert.updateOne(
      { _id: alert._id, serverId: alert.serverId },
      { $set: { incidentId: incident._id } },
    );
  } catch {
    console.error('Incident grouping failed');
  }
}
