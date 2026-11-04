import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { allowlistIps } from '../src/config/agentPolicy.js';
import { Alert } from '../src/models/Alert.js';
import { Command } from '../src/models/Command.js';
import { Event } from '../src/models/Event.js';
import { Rule } from '../src/models/Rule.js';
import { Server } from '../src/models/Server.js';
import { User } from '../src/models/User.js';
import { seedDefaultRules } from '../src/services/ruleSeed.js';
import { createServer, enrollAgent } from '../src/services/serverService.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let ownerA: string;
let ownerB: string;
let tokenA: string;
let serverA: string;
let serverB: string;
let agentA: string;

beforeAll(async () => {
  await Promise.all([
    User.init(),
    Server.init(),
    Command.init(),
    Event.init(),
    Alert.init(),
    Rule.init(),
  ]);
  const [a, b] = await User.create([
    {
      name: 'Command Owner A',
      email: 'command-a@example.com',
      passwordHash: 'unused',
    },
    {
      name: 'Command Owner B',
      email: 'command-b@example.com',
      passwordHash: 'unused',
    },
  ]);
  ownerA = a.id;
  ownerB = b.id;
  tokenA = jwt.sign({ sub: ownerA }, env.JWT_SECRET, { expiresIn: '7d' });
});

beforeEach(async () => {
  allowlistIps.splice(0, allowlistIps.length);
  await Promise.all([
    Command.deleteMany({}),
    Alert.deleteMany({}),
    Event.deleteMany({}),
    Rule.deleteMany({}),
    Server.deleteMany({}),
  ]);
  await seedDefaultRules();
  const a = await createServer(ownerA, 'Command Server A');
  const b = await createServer(ownerB, 'Command Server B');
  serverA = a.server.id;
  serverB = b.server.id;
  agentA = (
    await enrollAgent({
      key: a.enrollmentKey,
      hostname: 'agent-a',
      os: 'Linux',
      ip: '192.0.2.1',
      agentVersion: '1.0',
    })
  ).agentToken;
  await enrollAgent({
    key: b.enrollmentKey,
    hostname: 'agent-b',
    os: 'Linux',
    ip: '192.0.2.2',
    agentVersion: '1.0',
  });
});

it('creates a manual block command and delivers it in the contract shape on heartbeat', async () => {
  const created = await request(app)
    .post(`/api/servers/${serverA}/block-ip`)
    .set(auth(tokenA))
    .send({ ip: '198.51.100.7' })
    .expect(201);
  expect(created.body.command).toMatchObject({
    type: 'block_ip',
    payload: { ip: '198.51.100.7', durationSeconds: 3600 },
    status: 'pending',
    source: 'manual',
  });
  const heartbeat = await request(app)
    .post('/api/agent/heartbeat')
    .set(auth(agentA))
    .send({
      timestamp: new Date().toISOString(),
      agentVersion: '1.0',
      stats: { cpuPercent: 1, memoryMb: 20, bufferedEvents: 0 },
    })
    .expect(200);
  expect(heartbeat.body.commands).toEqual([
    {
      commandId: created.body.command._id,
      type: 'block_ip',
      payload: { ip: '198.51.100.7', durationSeconds: 3600 },
    },
  ]);
  expect((await Command.findById(created.body.command._id))?.status).toBe(
    'delivered',
  );
});

it('resends delivered commands after five minutes', async () => {
  const command = await Command.create({
    serverId: serverA,
    type: 'unblock_ip',
    payload: { ip: '198.51.100.7' },
    source: 'manual',
  });
  await Command.updateOne(
    { _id: command._id },
    {
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 5 * 60 * 1000 - 1),
    },
  );
  const heartbeat = await request(app)
    .post('/api/agent/heartbeat')
    .set(auth(agentA))
    .send({
      timestamp: new Date().toISOString(),
      agentVersion: '1.0',
      stats: { cpuPercent: 1, memoryMb: 20, bufferedEvents: 0 },
    })
    .expect(200);
  expect(heartbeat.body.commands).toEqual([
    {
      commandId: command.id,
      type: 'unblock_ip',
      payload: { ip: '198.51.100.7' },
    },
  ]);
});

it('records done and failed command results and isolates server commands', async () => {
  const own = await Command.create({
    serverId: serverA,
    type: 'block_ip',
    payload: { ip: '198.51.100.7' },
    source: 'manual',
  });
  const other = await Command.create({
    serverId: serverB,
    type: 'block_ip',
    payload: { ip: '198.51.100.8' },
    source: 'manual',
  });
  await request(app)
    .post(`/api/agent/commands/${own.id}/result`)
    .set(auth(agentA))
    .send({ status: 'done', message: 'blocked' })
    .expect(200);
  await request(app)
    .post(`/api/agent/commands/${other.id}/result`)
    .set(auth(agentA))
    .send({ status: 'failed' })
    .expect(404);
  expect((await Command.findById(own._id))?.status).toBe('done');
  const failed = await Command.create({
    serverId: serverA,
    type: 'unblock_ip',
    payload: { ip: '198.51.100.9' },
    source: 'manual',
  });
  await request(app)
    .post(`/api/agent/commands/${failed.id}/result`)
    .set(auth(agentA))
    .send({ status: 'failed' })
    .expect(200);
  expect((await Command.findById(failed._id))?.status).toBe('failed');
});

it('enforces owner-only access, IP validation and the allowlist', async () => {
  await request(app)
    .post(`/api/servers/${serverB}/block-ip`)
    .set(auth(tokenA))
    .send({ ip: '198.51.100.7' })
    .expect(404);
  await request(app)
    .post(`/api/servers/${serverA}/block-ip`)
    .set(auth(tokenA))
    .send({ ip: 'not-an-ip' })
    .expect(400);
  allowlistIps.push('203.0.113.8');
  const blocked = await request(app)
    .post(`/api/servers/${serverA}/block-ip`)
    .set(auth(tokenA))
    .send({ ip: '203.0.113.8' })
    .expect(400);
  expect(blocked.body.error.code).toBe('IP_ALLOWLISTED');
});

it('returns an existing pending block command for the same IP', async () => {
  const url = `/api/servers/${serverA}/block-ip`;
  const first = await request(app)
    .post(url)
    .set(auth(tokenA))
    .send({ ip: '198.51.100.7' })
    .expect(201);
  const second = await request(app)
    .post(url)
    .set(auth(tokenA))
    .send({ ip: '198.51.100.7', durationSeconds: 120 })
    .expect(201);
  expect(second.body.command._id).toBe(first.body.command._id);
  expect(
    await Command.countDocuments({
      serverId: serverA,
      type: 'block_ip',
      status: 'pending',
    }),
  ).toBe(1);
});

it('creates one rule block command for an SSH brute-force alert only', async () => {
  for (let i = 0; i < 5; i++) {
    await request(app)
      .post('/api/agent/events')
      .set(auth(agentA))
      .send({
        events: [
          {
            eventId: randomUUID(),
            type: 'ssh_failed_login',
            severity: 'medium',
            sourceIp: '198.51.100.7',
            timestamp: new Date().toISOString(),
            details: { user: 'root' },
          },
        ],
      })
      .expect(200);
  }
  expect(await Alert.countDocuments({ serverId: serverA })).toBe(1);
  expect(
    await Command.countDocuments({
      serverId: serverA,
      type: 'block_ip',
      source: 'rule',
    }),
  ).toBe(1);
  for (let i = 0; i < 2; i++) {
    await request(app)
      .post('/api/agent/events')
      .set(auth(agentA))
      .send({
        events: [
          {
            eventId: randomUUID(),
            type: 'ssh_failed_login',
            severity: 'medium',
            sourceIp: '198.51.100.7',
            timestamp: new Date().toISOString(),
            details: { user: 'root' },
          },
        ],
      })
      .expect(200);
  }
  expect(
    await Command.countDocuments({
      serverId: serverA,
      type: 'block_ip',
      source: 'rule',
    }),
  ).toBe(1);
});

it('creates no command for a rule with action alert', async () => {
  await Rule.updateOne({ name: 'Root login' }, { action: 'alert' });
  await request(app)
    .post('/api/agent/events')
    .set(auth(agentA))
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
  expect(await Alert.countDocuments({ serverId: serverA })).toBe(1);
  expect(await Command.countDocuments({ serverId: serverA })).toBe(0);
});
