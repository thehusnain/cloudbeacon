import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Alert } from '../src/models/Alert.js';
import { Event } from '../src/models/Event.js';
import { Rule } from '../src/models/Rule.js';
import { Server } from '../src/models/Server.js';
import { User } from '../src/models/User.js';
import { seedDefaultRules } from '../src/services/ruleSeed.js';
import { createServer, enrollAgent } from '../src/services/serverService.js';
import { getRulesVersion } from '../src/services/alertService.js';

const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
let userA: string;
let userB: string;
let tokenA: string;
let agentA: string;
let serverA: string;
let serverB: string;
async function postEvent(
  type: string,
  sourceIp = '198.51.100.7',
  details: Record<string, unknown> = {},
) {
  return request(app)
    .post('/api/agent/events')
    .set(auth(agentA))
    .send({
      events: [
        {
          eventId: randomUUID(),
          type,
          severity: 'medium',
          sourceIp,
          timestamp: new Date().toISOString(),
          details,
        },
      ],
    })
    .expect(200);
}

beforeAll(async () => {
  await Promise.all([
    User.init(),
    Server.init(),
    Event.init(),
    Rule.init(),
    Alert.init(),
  ]);
  const [a, b] = await User.create([
    {
      name: 'Alert User A',
      email: 'alert-a@example.com',
      passwordHash: 'test',
    },
    {
      name: 'Alert User B',
      email: 'alert-b@example.com',
      passwordHash: 'test',
    },
  ]);
  userA = a.id;
  userB = b.id;
  tokenA = jwt.sign({ sub: userA }, env.JWT_SECRET, { expiresIn: '7d' });
});
beforeEach(async () => {
  await Promise.all([
    Alert.deleteMany({}),
    Event.deleteMany({}),
    Rule.deleteMany({}),
    Server.deleteMany({}),
  ]);
  await seedDefaultRules();
  const a = await createServer(userA, 'Alert Server A');
  const b = await createServer(userB, 'Alert Server B');
  serverA = a.server.id;
  serverB = b.server.id;
  agentA = (
    await enrollAgent({
      key: a.enrollmentKey,
      hostname: 'alert-a',
      os: 'Linux',
      ip: '192.0.2.1',
      agentVersion: '1.0',
    })
  ).agentToken;
  const bAgent = (
    await enrollAgent({
      key: b.enrollmentKey,
      hostname: 'alert-b',
      os: 'Linux',
      ip: '192.0.2.2',
      agentVersion: '1.0',
    })
  ).agentToken;
  await request(app)
    .post('/api/agent/events')
    .set(auth(bAgent))
    .send({
      events: [
        {
          eventId: randomUUID(),
          type: 'root_login',
          severity: 'high',
          timestamp: new Date().toISOString(),
          details: { user: 'root' },
        },
      ],
    })
    .expect(200);
});

it('creates one brute-force alert on the fifth attempt and updates it for later attempts', async () => {
  for (let i = 0; i < 4; i++) {
    await postEvent('ssh_failed_login');
    expect(await Alert.countDocuments({ serverId: serverA })).toBe(0);
  }
  await postEvent('ssh_failed_login');
  let alerts = await Alert.find({ serverId: serverA });
  expect(alerts).toHaveLength(1);
  expect(alerts[0].eventIds).toHaveLength(5);
  expect(alerts[0].plainDescription).toContain('5 times');
  expect(alerts[0].plainDescription).toContain('198.51.100.7');
  await postEvent('ssh_failed_login');
  await postEvent('ssh_failed_login');
  alerts = await Alert.find({ serverId: serverA });
  expect(alerts).toHaveLength(1);
  expect(alerts[0].eventIds).toHaveLength(7);
  expect(alerts[0].plainDescription).toContain('7 times');
});

it('does not combine failed logins from different IP addresses', async () => {
  for (let i = 0; i < 4; i++)
    await postEvent('ssh_failed_login', '198.51.100.7');
  for (let i = 0; i < 4; i++)
    await postEvent('ssh_failed_login', '203.0.113.9');
  expect(await Alert.countDocuments({ serverId: serverA })).toBe(0);
  await postEvent('ssh_failed_login', '198.51.100.7');
  expect(await Alert.countDocuments({ serverId: serverA })).toBe(1);
  expect((await Alert.findOne({ serverId: serverA }))?.sourceIp).toBe(
    '198.51.100.7',
  );
});

it('does not evaluate duplicate events again', async () => {
  const event = {
    eventId: randomUUID(),
    type: 'root_login',
    severity: 'high',
    timestamp: new Date().toISOString(),
    details: { user: 'root' },
  };
  await request(app)
    .post('/api/agent/events')
    .set(auth(agentA))
    .send({ events: [event] })
    .expect(200);
  await request(app)
    .post('/api/agent/events')
    .set(auth(agentA))
    .send({ events: [event] })
    .expect(200);
  expect(await Alert.countDocuments({ serverId: serverA })).toBe(1);
  expect((await Alert.findOne({ serverId: serverA }))?.eventIds).toHaveLength(
    1,
  );
});

it.each([
  [
    'port_scan',
    'Port scan detected',
    { portsScanned: 20, windowSeconds: 10, scanType: 'tcp' },
  ],
  [
    'file_modified',
    'Sensitive file changed',
    { path: '/etc/passwd', oldHash: 'a', newHash: 'b' },
  ],
  [
    'permission_changed',
    'Permission change',
    { path: '/etc/shadow', oldMode: '0640', newMode: '0666' },
  ],
  ['root_login', 'Root login', { user: 'root' }],
] as const)('%s produces the matching alert', async (type, title, details) => {
  await postEvent(type, undefined as unknown as string, details);
  const alert = await Alert.findOne({ serverId: serverA }).populate('ruleId');
  expect(alert?.title).toContain(title);
  expect(alert?.severity).toBe(
    type === 'permission_changed' ? 'medium' : 'high',
  );
  expect(alert?.plainDescription.length).toBeGreaterThan(10);
});

it('does not alert for disabled rules', async () => {
  await Rule.updateOne({ name: 'Root login' }, { enabled: false });
  await postEvent('root_login', undefined as unknown as string, {
    user: 'root',
  });
  expect(await Alert.countDocuments({ serverId: serverA })).toBe(0);
});

it('restricts alert read and update to the owning user and validates status changes', async () => {
  await postEvent('root_login', undefined as unknown as string, {
    user: 'root',
  });
  const alertA = await Alert.findOne({ serverId: serverA }).orFail();
  const alertB = await Alert.findOne({ serverId: serverB }).orFail();
  for (const method of ['get', 'patch'] as const) {
    const response = await request(app)
      [method](`/api/alerts/${alertB.id}`)
      .set(auth(tokenA))
      .send(method === 'patch' ? { status: 'resolved' } : undefined)
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  }
  const patched = await request(app)
    .patch(`/api/alerts/${alertA.id}`)
    .set(auth(tokenA))
    .send({ status: 'acknowledged' })
    .expect(200);
  expect(patched.body.alert.status).toBe('acknowledged');
  await request(app)
    .patch(`/api/alerts/${alertA.id}`)
    .set(auth(tokenA))
    .send({ status: 'bad' })
    .expect(400);
  await request(app)
    .patch(`/api/alerts/${alertA.id}`)
    .set(auth(tokenA))
    .send({ status: 'resolved', extra: true })
    .expect(400);
});

it('lists alerts with filters and pagination', async () => {
  await postEvent('root_login', undefined as unknown as string, {
    user: 'root',
  });
  const response = await request(app)
    .get('/api/alerts?status=open&page=1&limit=1')
    .set(auth(tokenA))
    .expect(200);
  expect(response.body).toMatchObject({ page: 1, limit: 1, total: 1 });
});

it('returns the contract rules shape only for an authenticated agent', async () => {
  const response = await request(app)
    .get('/api/agent/rules')
    .set(auth(agentA))
    .expect(200);
  expect(response.body).toEqual({
    rulesVersion: await getRulesVersion(),
    rules: expect.arrayContaining([
      expect.objectContaining({
        name: 'SSH brute force',
        type: 'ssh_failed_login',
        severity: 'high',
        enabled: true,
        conditions: { threshold: 5, windowSeconds: 60, groupBy: 'sourceIp' },
        action: 'block',
      }),
    ]),
    protectedPaths: ['/etc/passwd', '/etc/shadow', '/etc/ssh/sshd_config'],
    allowlistIps: [],
  });
  await request(app).get('/api/agent/rules').expect(401);
});
