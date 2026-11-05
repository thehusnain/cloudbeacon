import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { Event } from '../src/models/Event.js';
import { applyCommonMiddleware } from '../src/middleware/common.js';
import { createAgentLimiter } from '../src/middleware/agentRateLimit.js';
import { registerDeviceToken } from '../src/services/deviceService.js';
import { startOfflineJob } from '../src/jobs/offlineJob.js';
let userId: string;
let token: string;
let own: string;
let other: string;
const auth = () => ({ Authorization: `Bearer ${token}` });
beforeAll(async () => {
  const user = await User.create({
    name: 'Review User',
    email: 'review@example.com',
    passwordHash: 'never-return',
    fcmTokens: ['private-device'],
  });
  userId = user.id;
  token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' });
  own = (
    await Server.create({
      owner: user._id,
      name: 'Own server',
      agentTokenHash: 'never-return',
    })
  ).id;
  other = (
    await Server.create({ owner: new Types.ObjectId(), name: 'Other server' })
  ).id;
});
it('rejects unused input, extra fields, arrays and query injection objects', async () => {
  for (const url of [
    '/api/auth/me?extra=1',
    '/api/alerts?serverId[$ne]=x',
    '/api/events?page=1&page=2',
    '/api/stats/events-over-time?hours=1&hours=2',
  ])
    await request(app).get(url).set(auth()).expect(400);
  await request(app)
    .post('/api/auth/login')
    .send({ email: { $ne: null }, password: 'Password123' })
    .expect(400);
  await request(app)
    .post('/api/auth/login?extra=1')
    .send({ email: 'review@example.com', password: 'Password123' })
    .expect(400);
  await request(app)
    .get('/api/events')
    .set(auth())
    .send({ data: 'unused' })
    .expect(400);
  await request(app)
    .delete(`/api/servers/${own}?extra=1`)
    .set(auth())
    .expect(400);
  await request(app)
    .delete('/api/devices/device')
    .set(auth())
    .send({ unused: 1 })
    .expect(400);
});
it('returns 404 for another owner’s filtered data', async () => {
  for (const resource of ['events', 'alerts', 'incidents'])
    await request(app)
      .get(`/api/${resource}?serverId=${other}`)
      .set(auth())
      .expect(404);
});
it('removes sensitive fields from nested evidence and user serialization', async () => {
  await Event.create({
    serverId: own,
    eventId: 'secrets',
    type: 'system_log',
    severity: 'low',
    timestamp: new Date(),
    details: {
      passwordHash: 'private',
      keyHash: 'private',
      agentTokenHash: 'private',
      token: 'private',
      tokens: ['private'],
      stack: 'private',
      nested: { Authorization: 'private', password: 'private' },
      message: 'Safe message',
    },
  });
  const response = await request(app)
    .get(`/api/events?serverId=${own}`)
    .set(auth())
    .expect(200);
  expect(JSON.stringify(response.body)).not.toContain('private');
  expect(response.body.items[0].details.message).toBe('Safe message');
  const serialized = (
    await User.findById(userId).select('+passwordHash').orFail()
  ).toJSON();
  expect(serialized).not.toHaveProperty('passwordHash');
  expect(serialized).not.toHaveProperty('fcmTokens');
});
it('never logs credential paths, query strings, headers or bodies', async () => {
  const logger = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await request(app)
      .delete('/api/devices/secret-device-value')
      .set(auth())
      .expect(200);
    await request(app)
      .post('/api/auth/login?key=secret-key-value')
      .send({ password: 'secret-password-value' })
      .expect(400);
    await request(app).get('/unknown/secret-unmatched-value').expect(404);
    const logged = JSON.stringify(logger.mock.calls);
    for (const secret of [
      'secret-device-value',
      'secret-key-value',
      'secret-password-value',
      'secret-unmatched-value',
      token,
    ])
      expect(logged).not.toContain(secret);
  } finally {
    logger.mockRestore();
  }
});
it('keeps the agent allowance independent of the global 100-request cap', async () => {
  const testApp = express();
  applyCommonMiddleware(testApp);
  testApp.use('/api/agent', createAgentLimiter());
  testApp.get('/api/agent/test', (_req, res) => res.sendStatus(204));
  const logger = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    for (let i = 0; i < 101; i++)
      await request(testApp).get('/api/agent/test').expect(204);
  } finally {
    logger.mockRestore();
  }
});
it('retains the device cap under concurrent registration', async () => {
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      registerDeviceToken(userId, `parallel-${i}`),
    ),
  );
  const user = await User.findById(userId).orFail();
  expect(user.fcmTokens).toHaveLength(10);
  expect(new Set(user.fcmTokens).size).toBe(10);
});
it('waits for an active offline check when stopped', async () => {
  vi.useFakeTimers();
  let finish!: (value: number) => void;
  const check = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  try {
    const stop = startOfflineJob({ intervalMs: 1000, check });
    await vi.advanceTimersByTimeAsync(3000);
    expect(check).toHaveBeenCalledTimes(1);
    let stopped = false;
    const done = stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    finish(0);
    await done;
    expect(stopped).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(check).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it('prevents IPv6 spelling and IPv4-mapped bypasses of protected IP checks', async () => {
  const { createCommand } = await import('../src/services/commandService.js');
  const { allowlistIps } = await import('../src/config/agentPolicy.js');
  await Server.updateOne({ _id: own }, { ip: '2001:db8::1' });
  await expect(
    createCommand(
      own,
      'block_ip',
      { ip: '2001:0db8:0:0:0:0:0:1' },
      'manual',
      userId,
    ),
  ).rejects.toMatchObject({ code: 'SERVER_IP_CANNOT_BE_BLOCKED' });
  allowlistIps.push('192.0.2.8');
  try {
    await expect(
      createCommand(
        own,
        'block_ip',
        { ip: '::ffff:192.0.2.8' },
        'manual',
        userId,
      ),
    ).rejects.toMatchObject({ code: 'IP_ALLOWLISTED' });
  } finally {
    allowlistIps.pop();
  }
});
