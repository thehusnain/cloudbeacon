import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { Event } from '../src/models/Event.js';
import { Alert } from '../src/models/Alert.js';
import { Incident } from '../src/models/Incident.js';
import {
  getEventsOverTime,
  getOverview,
} from '../src/services/statsService.js';
let owner: string;
let token: string;
let other: string;
const now = new Date('2026-01-01T12:30:00Z');
beforeAll(async () => {
  await Promise.all([
    Server.init(),
    Event.init(),
    Alert.init(),
    Incident.init(),
  ]);
  const users = await User.create([
    { name: 'Stats A', email: 'stats-a@example.com', passwordHash: 'unused' },
    { name: 'Stats B', email: 'stats-b@example.com', passwordHash: 'unused' },
  ]);
  owner = users[0].id;
  other = users[1].id;
  token = jwt.sign({ sub: owner }, env.JWT_SECRET, { expiresIn: '7d' });
  const servers = await Server.create([
    { owner, name: 'Stats online', status: 'online' },
    { owner, name: 'Stats offline', status: 'offline' },
    { owner, name: 'Stats pending' },
    { owner: other, name: 'Private', status: 'online' },
  ]);
  for (const [index, server] of servers.entries()) {
    await Event.create({
      serverId: server._id,
      eventId: `stats-${index}`,
      type: 'root_login',
      severity: 'high',
      timestamp: now,
    });
    await Alert.create({
      serverId: server._id,
      ruleId: new Types.ObjectId(),
      severity: index === 0 ? 'high' : 'medium',
      title: 'Test',
      plainDescription: 'Test',
    });
    await Incident.create({
      serverId: server._id,
      title: 'Test',
      severity: 'high',
      startedAt: now,
      lastActivityAt: now,
    });
  }
  await Event.create({
    serverId: servers[0]._id,
    eventId: 'old',
    type: 'system_log',
    severity: 'low',
    timestamp: new Date('2025-12-30T00:00:00Z'),
  });
  await Alert.create({
    serverId: servers[0]._id,
    ruleId: new Types.ObjectId(),
    severity: 'critical',
    title: 'Resolved',
    plainDescription: 'Test',
    status: 'resolved',
  });
});
it('counts only the owner’s servers, open alerts and incidents, and recent events', async () => {
  expect(await getOverview(owner, now)).toEqual({
    servers: { total: 3, online: 1, offline: 1, pending: 1 },
    alerts: {
      open: 3,
      bySeverity: { low: 0, medium: 2, high: 1, critical: 0 },
    },
    incidents: { open: 3 },
    events: { last24h: 3 },
  });
  expect((await getOverview(other, now)).servers.total).toBe(1);
  const response = await request(app)
    .get('/api/stats/overview')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(response.body.alerts.open).toBe(3);
});
it('fills hourly UTC buckets and excludes other owners', async () => {
  expect(await getEventsOverTime(owner, 3, now)).toEqual({
    buckets: [
      { start: '2026-01-01T10:00:00.000Z', count: 0 },
      { start: '2026-01-01T11:00:00.000Z', count: 0 },
      { start: '2026-01-01T12:00:00.000Z', count: 3 },
    ],
  });
  const response = await request(app)
    .get('/api/stats/events-over-time')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(response.body.buckets).toHaveLength(24);
});
it('requires auth and rejects invalid hours and unknown filters', async () => {
  await request(app).get('/api/stats/overview').expect(401);
  for (const hours of ['0', '169', '1.5', 'bad'])
    await request(app)
      .get(`/api/stats/events-over-time?hours=${hours}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  await request(app)
    .get('/api/stats/overview?owner=other')
    .set('Authorization', `Bearer ${token}`)
    .expect(400);
});
