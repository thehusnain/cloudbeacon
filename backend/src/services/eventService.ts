import { Event } from '../models/Event.js';
import { Server } from '../models/Server.js';
import { eventSchema, type EVENT_TYPES } from '../utils/eventSchema.js';

export type EventFilters = {
  serverId?: string;
  type?: (typeof EVENT_TYPES)[number];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  sourceIp?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
};

export async function ingestEvents(serverId: string, input: unknown[]) {
  const valid: Array<Record<string, unknown>> = [];
  const rejected: Array<{ eventId: string | null; reason: string }> = [];
  for (const raw of input) {
    const result = eventSchema.safeParse(raw);
    if (result.success) valid.push({ ...result.data, serverId });
    else {
      const id =
        typeof raw === 'object' &&
        raw !== null &&
        'eventId' in raw &&
        typeof raw.eventId === 'string'
          ? raw.eventId
          : null;
      rejected.push({ eventId: id, reason: 'Invalid event fields' });
    }
  }
  const ids = valid.map((event) => event.eventId as string);
  const existing = ids.length
    ? await Event.find({ serverId, eventId: { $in: ids } })
        .select('eventId')
        .lean()
    : [];
  const existingIds = new Set(existing.map((event) => event.eventId));
  const batchIds = new Set<string>();
  let duplicates = 0;
  const insertable = valid.filter((event) => {
    const id = event.eventId as string;
    if (existingIds.has(id) || batchIds.has(id)) {
      duplicates += 1;
      return false;
    }
    batchIds.add(id);
    return true;
  });

  let accepted = 0;
  if (insertable.length) {
    try {
      const inserted = await Event.insertMany(insertable, { ordered: false });
      accepted = inserted.length;
    } catch (error) {
      const details = error as {
        writeErrors?: { code?: number } | { code?: number }[];
        result?: { insertedCount?: number };
        insertedDocs?: unknown[];
      };
      const rawErrors = details.writeErrors;
      const writeErrors =
        rawErrors === undefined
          ? []
          : Array.isArray(rawErrors)
            ? rawErrors
            : [rawErrors];
      if (
        !writeErrors.length ||
        writeErrors.some((item) => item.code !== 11000)
      ) {
        throw error;
      }
      duplicates += writeErrors.length;
      accepted =
        details.result?.insertedCount ??
        details.insertedDocs?.length ??
        insertable.length - writeErrors.length;
    }
  }
  return { accepted, duplicates, ...(rejected.length ? { rejected } : {}) };
}

export async function listEvents(ownerId: string, filters: EventFilters) {
  const owned = await Server.find({ owner: ownerId }, { _id: 1 }).lean();
  const serverIds = filters.serverId
    ? owned
        .filter((server) => server._id.toString() === filters.serverId)
        .map((server) => server._id)
    : owned.map((server) => server._id);
  const query: Record<string, unknown> = { serverId: { $in: serverIds } };
  if (filters.type) query.type = filters.type;
  if (filters.severity) query.severity = filters.severity;
  if (filters.sourceIp) query.sourceIp = filters.sourceIp;
  if (filters.from || filters.to)
    query.timestamp = {
      ...(filters.from ? { $gte: new Date(filters.from) } : {}),
      ...(filters.to ? { $lte: new Date(filters.to) } : {}),
    };
  const [items, total] = await Promise.all([
    Event.find(query)
      .sort({ timestamp: -1, _id: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
    Event.countDocuments(query),
  ]);
  return { items, page: filters.page, limit: filters.limit, total };
}
