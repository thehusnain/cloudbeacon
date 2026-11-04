import { beforeEach, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { Alert } from '../src/models/Alert.js';
import { Incident } from '../src/models/Incident.js';
import { Event } from '../src/models/Event.js';
import { Rule } from '../src/models/Rule.js';
import { attachAlertToIncident } from '../src/services/incidentService.js';
import { ingestEvents } from '../src/services/eventService.js';
const server = new Types.ObjectId();
async function attach(
  minutes: number,
  ip = '198.51.100.1',
  severity: 'low' | 'high' | 'critical' = 'low',
  serverId = server,
) {
  const event = await Event.create({
    serverId,
    eventId: new Types.ObjectId().toString(),
    type: 'root_login',
    severity,
    timestamp: new Date(Date.UTC(2026, 0, 1, 0, minutes)),
  });
  const alert = await Alert.create({
    serverId,
    ruleId: new Types.ObjectId(),
    title: 'Root login',
    plainDescription: 'Login',
    severity,
    sourceIp: ip,
    eventIds: [event._id],
  });
  await attachAlertToIncident(alert);
  return Alert.findById(alert._id).orFail();
}
beforeEach(async () => {
  await Promise.all([
    Incident.deleteMany({}),
    Alert.deleteMany({}),
    Event.deleteMany({}),
    Rule.deleteMany({}),
  ]);
});
it('creates and groups by IP or window, promotes severity and deduplicates evidence', async () => {
  const first = await attach(0);
  const second = await attach(60);
  expect(String(second.incidentId)).toBe(String(first.incidentId));
  const third = await attach(70, '198.51.100.2', 'critical');
  await attachAlertToIncident(third);
  const incident = await Incident.findById(first.incidentId).orFail();
  expect(incident.alertIds).toHaveLength(3);
  expect(incident.eventIds).toHaveLength(3);
  expect(incident.sourceIps).toHaveLength(2);
  expect(incident.severity).toBe('critical');
  expect(incident.lastActivityAt.toISOString()).toBe(
    '2026-01-01T01:10:00.000Z',
  );
  expect(incident.startedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  const later = await attach(101, '198.51.100.3');
  expect(String(later.incidentId)).not.toBe(String(first.incidentId));
});
it('never joins closed incidents or incidents on another server', async () => {
  const first = await attach(0);
  await Incident.updateOne({ _id: first.incidentId }, { status: 'closed' });
  const next = await attach(1);
  const other = await attach(2, '198.51.100.1', 'high', new Types.ObjectId());
  expect(String(next.incidentId)).not.toBe(String(first.incidentId));
  expect(String(other.incidentId)).not.toBe(String(next.incidentId));
});
it('updates incident evidence for alert updates and ignores resends', async () => {
  await Rule.create({
    name: 'Root test',
    type: 'root_login',
    severity: 'low',
    action: 'alert',
  });
  const event = (id: string) => ({
    eventId: id,
    type: 'root_login',
    severity: 'low',
    timestamp: new Date().toISOString(),
    details: {},
  });
  await ingestEvents(String(server), [event('one')]);
  await ingestEvents(String(server), [event('two')]);
  await ingestEvents(String(server), [event('two')]);
  const incident = await Incident.findOne({ serverId: server }).orFail();
  expect(incident.alertIds).toHaveLength(1);
  expect(incident.eventIds).toHaveLength(2);
});
it('does not fail ingestion if incident persistence fails', async () => {
  await Rule.create({
    name: 'Root failure',
    type: 'root_login',
    severity: 'low',
    action: 'alert',
  });
  const spy = vi
    .spyOn(Incident, 'create')
    .mockRejectedValueOnce(new Error('database error'));
  await expect(
    ingestEvents(String(server), [
      {
        eventId: 'failure',
        type: 'root_login',
        severity: 'low',
        timestamp: new Date().toISOString(),
        details: {},
      },
    ]),
  ).resolves.toMatchObject({ accepted: 1 });
  spy.mockRestore();
});
