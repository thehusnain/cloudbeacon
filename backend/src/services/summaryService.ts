import { Server } from '../models/Server.js';
import {
  loadIncidentEvidence,
  type IncidentEvidence,
} from './timelineService.js';
export async function buildSummary(
  incident: IncidentEvidence & {
    startedAt: Date;
    lastActivityAt: Date;
    sourceIps: string[];
    severity: string;
  },
) {
  const { events, alerts } = await loadIncidentEvidence(incident);
  const server = await Server.findById(incident.serverId).select('name').lean();
  const titles = [...new Set(alerts.map((alert) => alert.title))];
  const paths = events.flatMap((event) => {
    const details = event.details as Record<string, unknown> | undefined;
    return typeof details?.path === 'string' ? [details.path] : [];
  });
  return {
    startedAt: incident.startedAt,
    lastActivityAt: incident.lastActivityAt,
    whatHappened: titles.length
      ? `${alerts.length} alert${alerts.length === 1 ? '' : 's'}: ${titles.join(' followed by ')}`
      : 'Security events were recorded',
    affected: [...new Set([server?.name ?? 'Unknown server', ...paths])],
    sourceIps: incident.sourceIps,
    severity: incident.severity,
    eventCount: events.length,
    alertCount: alerts.length,
  };
}
