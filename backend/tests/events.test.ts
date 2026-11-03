import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Server } from '../src/models/Server.js';
import { User } from '../src/models/User.js';
import { createServer, enrollAgent } from '../src/services/serverService.js';

const event = (id: string, overrides = {}) => ({
  eventId: id,
  type: 'ssh_failed_login',
  severity: 'medium',
  sourceIp: '198.51.100.7',
  timestamp: '2026-11-03T10:00:00Z',
  details: { user: 'root' },
  ...overrides,
});
let userA: string;
let userB: string;
let tokenA: string;
let tokenB: string;
let agentToken: string;
let serverA: string;
let serverB: string;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await Promise.all([User.init(), Server.init(), Event.init()]);
  const [a, b] = await User.create([
    {
      name: 'Event User A',
      email: 'events-a@example.com',
      passwordHash: 'test',
    },
    {
      name: 'Event User B',
      email: 'events-b@example.com',
      passwordHash: 'test',
    },
  ]);
  userA = a.id;
  userB = b.id;
  tokenA = jwt.sign({ sub: userA }, env.JWT_SECRET, { expiresIn: '7d' });
  tokenB = jwt.sign({ sub: userB }, env.JWT_SECRET, { expiresIn: '7d' });
});
beforeEach(async () => {
  await Event.deleteMany({});
  await Server.deleteMany({});
  const a = await createServer(userA, 'Agent Server A');
  const b = await createServer(userB, 'Agent Server B');
  serverA = a.server.id;
  serverB = b.server.id;
  agentToken = (
    await enrollAgent({
      key: a.enrollmentKey,
      hostname: 'host-a',
      os: 'Linux',
      ip: '192.0.2.1',
      agentVersion: '1.0.0',
    })
  ).agentToken;
});

it('accepts events and counts resends as duplicates', async () => {
  const batch = [
    event(new Types.ObjectId().toString()),
    event(new Types.ObjectId().toString(), { severity: 'high' }),
  ];
  const first = await request(app)
    .post('/api/agent/events')
    .set(auth(agentToken))
    .send({ events: batch })
    .expect(200);
  expect(first.body).toEqual({ accepted: 2, duplicates: 0 });
  expect(await Event.countDocuments({ serverId: serverA })).toBe(2);
  const again = await request(app)
    .post('/api/agent/events')
    .set(auth(agentToken))
    .send({ events: batch })
    .expect(200);
  expect(again.body).toEqual({ accepted: 0, duplicates: 2 });
  expect(await Event.countDocuments({ serverId: serverA })).toBe(2);
});

it('counts repeated event IDs within one batch as duplicates', async () => {
  const repeated = event('evt-repeated');
  const response = await request(app)
    .post('/api/agent/events')
    .set(auth(agentToken))
    .send({ events: [repeated, repeated] })
    .expect(200);
  expect(response.body).toEqual({ accepted: 1, duplicates: 1 });
  expect(await Event.countDocuments({ serverId: serverA })).toBe(1);
});

it('counts stored and newly inserted events correctly in a mixed batch', async () => {
  const existing = event('evt-existing');
  await Event.create({
    ...existing,
    serverId: serverA,
    timestamp: new Date(existing.timestamp),
  });
  const response = await request(app)
    .post('/api/agent/events')
    .set(auth(agentToken))
    .send({ events: [existing, event('evt-new')] })
    .expect(200);
  expect(response.body).toEqual({ accepted: 1, duplicates: 1 });
  expect(await Event.countDocuments({ serverId: serverA })).toBe(2);
});

it('rejects one invalid event while accepting the rest and enforces the batch limit', async () => {
  const response = await request(app)
    .post('/api/agent/events')
    .set(auth(agentToken))
    .send({
      events: [
        event('evt-good'),
        event('evt-bad', { severity: 'extreme' }),
        event('evt-good-2'),
      ],
    })
    .expect(200);
  expect(response.body).toEqual({
    accepted: 2,
    duplicates: 0,
    rejected: [{ eventId: 'evt-bad', reason: 'Invalid event fields' }],
  });
  await request(app)
    .post('/api/agent/events')
    .set(auth(agentToken))
    .send({ events: Array.from({ length: 501 }, (_, i) => event(`evt-${i}`)) })
    .expect(400);
});

it('rejects missing and wrong agent tokens and stores events only under the authenticated server', async () => {
  await request(app)
    .post('/api/agent/events')
    .send({ events: [event('evt-unauth')] })
    .expect(401);
  await request(app)
    .post('/api/agent/events')
    .set(auth('wrong-token'))
    .send({ events: [event('evt-wrong')] })
    .expect(401);
  await request(app)
    .post('/api/agent/events')
    .set(auth(agentToken))
    .send({ events: [event('evt-owner')] })
    .expect(200);
  expect(await Event.countDocuments({ serverId: serverA })).toBe(1);
  expect(await Event.countDocuments({ serverId: serverB })).toBe(0);
});

it('records heartbeat and restores an offline server to online', async () => {
  await Server.updateOne({ _id: serverA }, { status: 'offline' });
  const response = await request(app)
    .post('/api/agent/heartbeat')
    .set(auth(agentToken))
    .send({
      timestamp: '2026-11-03T10:00:00Z',
      agentVersion: '1.2.3',
      stats: { cpuPercent: 12.5, memoryMb: 256, bufferedEvents: 3 },
    })
    .expect(200);
  expect(response.body).toEqual({
    serverTime: expect.any(String),
    rulesVersion: 0,
    commands: [],
  });
  const server = await Server.findById(serverA).orFail();
  expect(server.status).toBe('online');
  expect(server.lastHeartbeat).toBeInstanceOf(Date);
  expect(server.agentVersion).toBe('1.2.3');
  expect(server.stats).toMatchObject({
    cpuPercent: 12.5,
    memoryMb: 256,
    bufferedEvents: 3,
  });
});

it('lists only owned events with filters and pagination', async () => {
  const stamp = '2026-11-03T10:00:00Z';
  await Event.create([
    {
      ...event('a-old', { timestamp: '2026-11-01T10:00:00Z' }),
      serverId: serverA,
    },
    {
      ...event('a-new', {
        severity: 'high',
        sourceIp: '203.0.113.8',
        timestamp: stamp,
      }),
      serverId: serverA,
    },
    { ...event('b-private'), serverId: serverB },
  ]);
  const page = await request(app)
    .get('/api/events?severity=high&page=1&limit=1')
    .set(auth(tokenA))
    .expect(200);
  expect(page.body).toMatchObject({
    page: 1,
    limit: 1,
    total: 1,
    items: [expect.objectContaining({ eventId: 'a-new' })],
  });
  const filtered = await request(app)
    .get(
      `/api/events?serverId=${serverA}&type=ssh_failed_login&sourceIp=203.0.113.8&from=${encodeURIComponent(stamp)}&to=${encodeURIComponent(stamp)}`,
    )
    .set(auth(tokenA))
    .expect(200);
  expect(filtered.body.total).toBe(1);
  expect(filtered.body.items[0].eventId).toBe('a-new');
  const all = await request(app)
    .get('/api/events?limit=100')
    .set(auth(tokenA))
    .expect(200);
  expect(all.body.total).toBe(2);
  expect(
    all.body.items.map((item: { eventId: string }) => item.eventId),
  ).not.toContain('b-private');
  const bList = await request(app)
    .get('/api/events')
    .set(auth(tokenB))
    .expect(200);
  expect(
    bList.body.items.map((item: { eventId: string }) => item.eventId),
  ).toEqual(['b-private']);
});
