import { beforeAll, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { Incident } from '../src/models/Incident.js';
import { Event } from '../src/models/Event.js';
import { Alert } from '../src/models/Alert.js';
import { Rule } from '../src/models/Rule.js';
import { ingestEvents } from '../src/services/eventService.js';
import { describeEvent } from '../src/services/timelineService.js';
import { EVENT_TYPES } from '../src/utils/eventSchema.js';
let token: string;
let serverId: Types.ObjectId;
beforeAll(async () => {
  const user = await User.create({
    name: 'Trace user',
    email: 'trace@example.com',
    passwordHash: 'unused',
  });
  token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '7d' });
  serverId = (await Server.create({ owner: user._id, name: 'Trace server' }))
    ._id;
});
const auth = () => ({ Authorization: `Bearer ${token}` });
it('returns ordered timeline, collapses 20 logins with evidence, supplies summary and updates status', async () => {
  const events = await Event.create(
    Array.from({ length: 20 }, (_, i) => ({
      serverId,
      eventId: `login-${i}`,
      type: 'ssh_failed_login',
      severity: 'medium',
      sourceIp: '198.51.100.7',
      timestamp: new Date(Date.UTC(2026, 0, 1, 10, 0, i + 1)),
      details: { user: 'root' },
    })),
  );
  const file = await Event.create({
    serverId,
    eventId: 'file',
    type: 'file_modified',
    severity: 'high',
    timestamp: new Date('2026-01-01T10:01:00Z'),
    details: { path: '/etc/shadow' },
  });
  const alert = await Alert.create({
    serverId,
    ruleId: new Types.ObjectId(),
    severity: 'high',
    title: 'Brute force',
    plainDescription: 'Attempts',
    eventIds: events.map((e) => e._id),
    createdAt: new Date('2026-01-01T10:02:00Z'),
  });
  const incident = await Incident.create({
    serverId,
    title: 'Test',
    severity: 'high',
    sourceIps: ['198.51.100.7'],
    startedAt: events[0].timestamp,
    lastActivityAt: file.timestamp,
    eventIds: [...events.map((e) => e._id), file._id],
    alertIds: [alert._id],
  });
  const response = await request(app)
    .get(`/api/incidents/${incident.id}/timeline`)
    .set(auth())
    .expect(200);
  expect(response.body.steps.map((s: { kind: string }) => s.kind)).toEqual([
    'event',
    'event',
    'alert',
  ]);
  expect(response.body.steps[0]).toMatchObject({
    count: 20,
    evidenceCount: 20,
  });
  expect(response.body.steps[0].evidence).toHaveLength(20);
  const summary = (
    await request(app)
      .get(`/api/incidents/${incident.id}`)
      .set(auth())
      .expect(200)
  ).body.incident.summary;
  expect(summary).toMatchObject({
    startedAt: '2026-01-01T10:00:01.000Z',
    sourceIps: ['198.51.100.7'],
    eventCount: 21,
    alertCount: 1,
  });
  expect(summary.affected).toContain('/etc/shadow');
  for (const status of ['closed', 'open'])
    expect(
      (
        await request(app)
          .patch(`/api/incidents/${incident.id}`)
          .set(auth())
          .send({ status })
          .expect(200)
      ).body.incident.status,
    ).toBe(status);
  await request(app)
    .patch(`/api/incidents/${incident.id}`)
    .set(auth())
    .send({ status: 'invalid' })
    .expect(400);
  const listed = await request(app)
    .get(`/api/incidents?serverId=${serverId}&severity=high&limit=1`)
    .set(auth())
    .expect(200);
  expect(listed.body.items).toHaveLength(1);
});
it('protects all incident routes and filtered lists from other users', async () => {
  const server = await Server.create({
    owner: new Types.ObjectId(),
    name: 'Other server',
  });
  const incident = await Incident.create({
    serverId: server._id,
    title: 'Private',
    severity: 'low',
    startedAt: new Date(),
    lastActivityAt: new Date(),
  });
  for (const path of ['', '/timeline'])
    await request(app)
      .get(`/api/incidents/${incident.id}${path}`)
      .set(auth())
      .expect(404);
  await request(app)
    .patch(`/api/incidents/${incident.id}`)
    .set(auth())
    .send({ status: 'closed' })
    .expect(404);
  await request(app)
    .get(`/api/incidents?serverId=${server.id}`)
    .set(auth())
    .expect(404);
  expect(
    (
      await request(app).get('/api/incidents').set(auth()).expect(200)
    ).body.items.some((i: { _id: string }) => i._id === incident.id),
  ).toBe(false);
  await request(app).get('/api/incidents').expect(401);
});
it('has safe plain-language templates for every event type', () => {
  for (const type of EVENT_TYPES)
    expect(describeEvent({ type })).not.toMatch(/undefined|\[object Object\]/);
  expect(
    describeEvent({
      type: 'ssh_failed_login',
      sourceIp: '198.51.100.7',
      details: { user: 'root' },
    }),
  ).toBe('Failed SSH login for user root from 198.51.100.7');
  expect(
    describeEvent({
      type: 'permission_changed',
      details: { path: '/etc/shadow', oldMode: '640', newMode: '777' },
    }),
  ).toBe('Permissions of /etc/shadow changed from 640 to 777');
});
it('groups brute force and file change into one incident whose timeline contains both', async () => {
  await Rule.create([
    {
      name: 'Trace brute',
      type: 'ssh_failed_login',
      severity: 'medium',
      action: 'alert',
      conditions: { threshold: 5, windowSeconds: 60, groupBy: 'sourceIp' },
    },
    {
      name: 'Trace file',
      type: 'file_modified',
      severity: 'medium',
      action: 'alert',
    },
  ]);
  const server = await Server.create({
    owner: (await User.findOne({ email: 'trace@example.com' }).orFail())._id,
    name: 'End to end',
  });
  const now = Date.now();
  await ingestEvents(
    server.id,
    Array.from({ length: 5 }, (_, i) => ({
      eventId: `e2e-${i}`,
      type: 'ssh_failed_login',
      severity: 'medium',
      sourceIp: '198.51.100.8',
      timestamp: new Date(now + i).toISOString(),
      details: { user: 'root' },
    })),
  );
  await ingestEvents(server.id, [
    {
      eventId: 'e2e-file',
      type: 'file_modified',
      severity: 'medium',
      sourceIp: '198.51.100.8',
      timestamp: new Date(now + 100).toISOString(),
      details: { path: '/etc/shadow' },
    },
  ]);
  const incidents = await Incident.find({ serverId: server._id });
  expect(incidents).toHaveLength(1);
  const timeline = await request(app)
    .get(`/api/incidents/${incidents[0].id}/timeline`)
    .set(auth())
    .expect(200);
  expect(timeline.body.steps.map((s: { type: string }) => s.type)).toContain(
    'file_modified',
  );
  expect(timeline.body.steps.map((s: { type: string }) => s.type)).toContain(
    'ssh_failed_login',
  );
});
