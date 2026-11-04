import { Event } from '../models/Event.js';
import { Alert } from '../models/Alert.js';
import type { Types } from 'mongoose';

export function describeEvent(event: {
  type: string;
  sourceIp?: string | null;
  details?: unknown;
}): string {
  const d = (
    event.details && typeof event.details === 'object' ? event.details : {}
  ) as Record<string, unknown>;
  const value = (key: string, fallback = 'unknown') =>
    typeof d[key] === 'string' || typeof d[key] === 'number'
      ? String(d[key])
      : fallback;
  const ip = event.sourceIp ?? value('ip', 'an unknown IP');
  const path = value('path', 'an unknown file');
  const templates: Record<string, string> = {
    ssh_failed_login: `Failed SSH login for user ${value('user')} from ${ip}`,
    ssh_login_success: `Successful SSH login for user ${value('user')} from ${ip}`,
    root_login: 'Root logged in',
    port_scan: `Port scan detected from ${ip} (${value('portsScanned')} ports in ${value('windowSeconds')} seconds)`,
    ping_scan: `Repeated network pings detected from ${ip} (${value('count')} pings)`,
    file_modified: `File ${path} was changed`,
    file_deleted: `File ${path} was deleted`,
    permission_changed: `Permissions of ${path} changed from ${value('oldMode')} to ${value('newMode')}`,
    system_log: `System log from ${value('source')}: ${value('message', 'No message provided')}`,
    ip_blocked: `The agent blocked ${value('ip', ip)}`,
    ip_unblocked: `The agent unblocked ${value('ip', ip)}`,
    file_protection_triggered: `The agent protected ${path} (${value('action', 'change prevented')})`,
  };
  return templates[event.type] ?? 'A security event was recorded';
}
export interface IncidentEvidence {
  serverId: Types.ObjectId;
  eventIds: Types.ObjectId[];
  alertIds: Types.ObjectId[];
}
export async function loadIncidentEvidence(incident: IncidentEvidence) {
  const [events, alerts] = await Promise.all([
    Event.find({ _id: { $in: incident.eventIds }, serverId: incident.serverId })
      .sort({ timestamp: 1, _id: 1 })
      .lean(),
    Alert.find({ _id: { $in: incident.alertIds }, serverId: incident.serverId })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
  ]);
  return { events, alerts };
}
export async function buildTimeline(incident: IncidentEvidence) {
  const { events, alerts } = await loadIncidentEvidence(incident);
  type Step = {
    timestamp: Date;
    kind: 'event' | 'alert';
    type: string;
    severity: string;
    description: string;
    evidence: unknown;
    sourceIp?: string | null;
    count?: number;
    firstAt?: Date;
    lastAt?: Date;
    evidenceCount?: number;
  };
  const steps: Step[] = events.map((event) => ({
    timestamp: event.timestamp,
    kind: 'event',
    type: event.type,
    severity: event.severity,
    description: describeEvent(event),
    sourceIp: event.sourceIp,
    evidence: {
      type: event.type,
      sourceIp: event.sourceIp,
      details: event.details,
      eventId: event.eventId,
    },
  }));
  steps.push(
    ...alerts.map((alert) => ({
      timestamp: alert.createdAt,
      kind: 'alert' as const,
      type: 'alert',
      severity: alert.severity,
      description: `Alert raised: ${alert.title}`,
      evidence: { alertId: String(alert._id), title: alert.title },
    })),
  );
  steps.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const result: Step[] = [];
  for (let i = 0; i < steps.length && result.length < 500;) {
    const first = steps[i];
    let end = i + 1;
    if (first.kind === 'event' && first.type === 'ssh_failed_login') {
      while (
        end < steps.length &&
        steps[end].kind === 'event' &&
        steps[end].type === first.type &&
        steps[end].sourceIp === first.sourceIp
      )
        end++;
    }
    if (end - i > 5) {
      const last = steps[end - 1];
      result.push({
        ...first,
        description: `${end - i} failed SSH logins from ${first.sourceIp ?? 'an unknown IP'} between ${first.timestamp.toISOString().slice(11, 19)} and ${last.timestamp.toISOString().slice(11, 19)}`,
        count: end - i,
        firstAt: first.timestamp,
        lastAt: last.timestamp,
        evidenceCount: end - i,
        evidence: steps
          .slice(i, Math.min(end, i + 50))
          .map((step) => step.evidence),
      });
      i = end;
    } else {
      result.push(first);
      i++;
    }
  }
  return result;
}
