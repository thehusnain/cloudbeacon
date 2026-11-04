import { Types } from 'mongoose';
import { Alert } from '../models/Alert.js';
import { Event } from '../models/Event.js';
import { Rule } from '../models/Rule.js';

export function ruleAppliesToServer(
  rule: { scope?: { serverId?: unknown } | null },
  serverId: string,
): boolean {
  return !rule.scope?.serverId || String(rule.scope.serverId) === serverId;
}

export function eventMatchesRule(
  rule: { type: string; enabled?: boolean },
  event: { type: string },
): boolean {
  return rule.enabled !== false && rule.type === event.type;
}

function alertTitle(
  ruleName: string,
  event: { details?: Record<string, unknown> },
): string {
  const path = event.details?.path;
  return typeof path === 'string' ? `${ruleName}: ${path}` : ruleName;
}

function describe(
  ruleName: string,
  count: number,
  windowSeconds: number,
  sourceIp?: string,
): string {
  if (ruleName === 'SSH brute force') {
    const duration =
      windowSeconds >= 60
        ? `${Math.round(windowSeconds / 60)} minute${windowSeconds >= 120 ? 's' : ''}`
        : `${windowSeconds} seconds`;
    return `Someone tried to guess the password for your server ${count} times in ${duration}${sourceIp ? ` from ${sourceIp}` : ''}.`;
  }
  const messages: Record<string, string> = {
    'Port scan detected': 'Someone checked your server for open network ports.',
    'Sensitive file changed': `A watched file${sourceIp ? ` on your server from ${sourceIp}` : ''} was changed.`,
    'Permission change': 'The permissions on a file changed.',
    'Root login': 'Someone signed in to your server as root.',
  };
  return (
    messages[ruleName] ?? `Your server detected ${ruleName.toLowerCase()}.`
  );
}

export async function evaluateEvents(
  serverId: string,
  insertedEvents: Array<{
    _id: Types.ObjectId;
    type: string;
    timestamp: Date;
    sourceIp?: string;
    details?: Record<string, unknown>;
  }>,
): Promise<void> {
  try {
    const rules = await Rule.find({
      enabled: true,
      $or: [
        { 'scope.serverId': { $exists: false } },
        { 'scope.serverId': null },
        { 'scope.serverId': serverId },
      ],
    }).lean();
    for (const event of insertedEvents) {
      for (const rule of rules) {
        if (
          !ruleAppliesToServer(rule, serverId) ||
          !eventMatchesRule(rule, event)
        )
          continue;
        const conditions = rule.conditions ?? {};
        let eventIds = [event._id];
        let count = 1;
        if (conditions.threshold) {
          if (conditions.groupBy === 'sourceIp' && !event.sourceIp) continue;
          const start = new Date(
            event.timestamp.getTime() - (conditions.windowSeconds ?? 60) * 1000,
          );
          const matches = (await Event.find({
            serverId: new Types.ObjectId(serverId),
            type: event.type as (typeof import('../utils/eventSchema.js').EVENT_TYPES)[number],
            ...(conditions.groupBy === 'sourceIp'
              ? { sourceIp: event.sourceIp }
              : {}),
            timestamp: { $gte: start, $lte: event.timestamp },
          } as never)
            .sort({ timestamp: 1 })
            .select('_id')
            .lean()) as unknown as Array<{ _id: Types.ObjectId }>;
          count = matches.length;
          if (count < conditions.threshold) continue;
          eventIds = matches.map((item) => item._id);
        }
        const title = alertTitle(rule.name, event);
        const groupWindow = (conditions.windowSeconds ?? 600) * 1000;
        const existing = await Alert.findOne({
          serverId,
          ruleId: rule._id,
          status: 'open',
          sourceIp: event.sourceIp ?? null,
          title,
          createdAt: {
            $gte: new Date(event.timestamp.getTime() - groupWindow),
          },
        });
        if (existing) {
          existing.eventIds = [
            ...new Set([
              ...existing.eventIds.map(String),
              ...eventIds.map(String),
            ]),
          ] as unknown as Types.ObjectId[];
          existing.plainDescription = describe(
            rule.name,
            count,
            conditions.windowSeconds ?? 600,
            event.sourceIp,
          );
          await existing.save();
        } else {
          await Alert.create({
            serverId,
            ruleId: rule._id,
            severity: rule.severity,
            title,
            plainDescription: describe(
              rule.name,
              count,
              conditions.windowSeconds ?? 600,
              event.sourceIp,
            ),
            status: 'open',
            eventIds,
            sourceIp: event.sourceIp,
          });
        }
      }
    }
  } catch (error) {
    console.error('Alert evaluation failed', error);
  }
}

export async function getRulesVersion(): Promise<number> {
  const latest = await Rule.findOne()
    .sort({ updatedAt: -1 })
    .select('updatedAt')
    .lean();
  return latest?.updatedAt ? latest.updatedAt.getTime() : 0;
}
