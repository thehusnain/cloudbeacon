import { z } from 'zod';

export const EVENT_TYPES = [
  'ssh_failed_login', 'ssh_login_success', 'root_login', 'port_scan', 'ping_scan',
  'file_modified', 'file_deleted', 'permission_changed', 'system_log', 'ip_blocked',
  'ip_unblocked', 'file_protection_triggered',
] as const;

const isoDateTime = z.iso.datetime({ offset: true });
export const eventSchema = z.object({
  eventId: z.string().min(1).max(100),
  type: z.enum(EVENT_TYPES),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  sourceIp: z.union([z.ipv4(), z.ipv6()]).optional(),
  timestamp: isoDateTime,
  details: z.record(z.string(), z.unknown()).default({}).refine((value) => Buffer.byteLength(JSON.stringify(value)) <= 10_240, 'details must not exceed 10 KB'),
}).transform((event) => ({ ...event, timestamp: new Date(event.timestamp) }));

export const eventBatchSchema = z.object({ events: z.array(z.unknown()).max(500) });
export const eventsQuerySchema = z.object({
  serverId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  sourceIp: z.union([z.ipv4(), z.ipv6()]).optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict().refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), { path: ['to'], message: 'to must be after from' });
