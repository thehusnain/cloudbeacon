import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, beforeEach, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Server } from '../src/models/Server.js';
import { EnrollmentKey } from '../src/models/EnrollmentKey.js';
import * as service from '../src/services/serverService.js';
import { agentAuth } from '../src/middleware/agentAuth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createAgentRouter } from '../src/routes/agent.js';
import { compareHashes, generateSecret, sha256 } from '../src/utils/crypto.js';

let ownerA: string;
let ownerB: string;
let tokenA: string;
let tokenB: string;
const metadata = {
  hostname: 'server-1',
  os: 'Ubuntu 24.04',
  ip: '192.0.2.1',
  agentVersion: '0.1.0',
};
const noHashes = (value: unknown) => {
  expect(JSON.stringify(value)).not.toMatch(/keyHash|agentTokenHash/);
};

beforeAll(async () => {
  await Promise.all([User.init(), Server.init(), EnrollmentKey.init()]);
  const users = await User.create([
    {
      name: 'Owner A',
      email: 'a@example.com',
      passwordHash: 'unused-test-hash',
    },
    {
      name: 'Owner B',
      email: 'b@example.com',
      passwordHash: 'unused-test-hash',
    },
  ]);
  ownerA = users[0].id;
  ownerB = users[1].id;
  tokenA = jwt.sign({ sub: ownerA }, env.JWT_SECRET, { expiresIn: '7d' });
  tokenB = jwt.sign({ sub: ownerB }, env.JWT_SECRET, { expiresIn: '7d' });
});
beforeEach(async () => {
  await Promise.all([Server.deleteMany({}), EnrollmentKey.deleteMany({})]);
});

it('creates a pending server and returns a plain key only once, persisting only its hash', async () => {
  const before = Date.now();
  const created = await request(app)
    .post('/api/servers')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ name: '  My Server  ' })
    .expect(201);
  expect(created.body.server).toMatchObject({
    name: 'My Server',
    owner: ownerA,
    status: 'pending',
    lastHeartbeat: null,
  });
  expect(created.body.enrollmentKey).toMatch(/^[a-f0-9]{64}$/);
  expect(new Date(created.body.expiresAt).getTime()).toBeGreaterThanOrEqual(
    before + 15 * 60 * 1000,
  );
  const stored = await EnrollmentKey.findOne({
    serverId: created.body.server.id,
  })
    .select('+keyHash')
    .orFail();
  expect(stored.keyHash).toBe(sha256(created.body.enrollmentKey));
  expect(stored.usedAt).toBeNull();
  noHashes(stored.toJSON());
  const raw = await EnrollmentKey.collection.findOne({ _id: stored._id });
  expect(JSON.stringify(raw)).not.toContain(created.body.enrollmentKey);
  const listed = await request(app)
    .get('/api/servers')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  const fetched = await request(app)
    .get(`/api/servers/${created.body.server.id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  expect(listed.body.servers).toHaveLength(1);
  for (const response of [created, listed, fetched]) noHashes(response.body);
  expect(JSON.stringify([listed.body, fetched.body])).not.toContain(
    created.body.enrollmentKey,
  );
  const indexes = await EnrollmentKey.collection.indexes();
  expect(indexes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    ]),
  );
});

it('enrolls once, stores only the token hash, and populates server metadata', async () => {
  const created = await service.createServer(ownerA, 'Enrollment Server');
  const response = await request(app)
    .post('/api/agent/enroll')
    .send({ key: created.enrollmentKey, ...metadata })
    .expect(201);
  expect(response.body).toEqual({
    serverId: created.server.id,
    agentToken: expect.stringMatching(/^[a-f0-9]{64}$/),
    heartbeatIntervalSeconds: 30,
  });
  const stored = await Server.findById(created.server.id)
    .select('+agentTokenHash')
    .orFail();
  expect(stored.agentTokenHash).toBe(sha256(response.body.agentToken));
  expect(stored.status).toBe('online');
  expect(stored.lastHeartbeat).toBeInstanceOf(Date);
  expect(stored.toObject()).toMatchObject(metadata);
  noHashes(stored.toJSON());
  expect(
    (await Server.findById(stored._id).orFail()).agentTokenHash,
  ).toBeUndefined();
  expect(
    JSON.stringify(await Server.collection.findOne({ _id: stored._id })),
  ).not.toContain(response.body.agentToken);
  expect(
    (await EnrollmentKey.findOne({ serverId: stored._id }).orFail()).usedAt,
  ).toBeInstanceOf(Date);
  noHashes(response.body);
  const read = await request(app)
    .get(`/api/servers/${stored.id}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  const list = await request(app)
    .get('/api/servers')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  noHashes(read.body);
  noHashes(list.body);
  expect(JSON.stringify([read.body, list.body])).not.toContain(
    response.body.agentToken,
  );
});

it('rejects unknown, expired and reused keys with their specified codes', async () => {
  const unknown = await request(app)
    .post('/api/agent/enroll')
    .send({ key: generateSecret(), ...metadata })
    .expect(400);
  expect(unknown.body.error.code).toBe('INVALID_KEY');
  const expired = await service.createServer(ownerA, 'Expired Server');
  // Simulate expiry without a TTL deletion race.
  await EnrollmentKey.updateOne(
    { serverId: expired.server.id },
    { expiresAt: new Date(Date.now() - 1) },
  );
  const expiredResponse = await request(app)
    .post('/api/agent/enroll')
    .send({ key: expired.enrollmentKey, ...metadata })
    .expect(400);
  expect(expiredResponse.body.error.code).toBe('KEY_EXPIRED');
  const used = await service.createServer(ownerA, 'Used Server');
  await service.enrollAgent({ key: used.enrollmentKey, ...metadata });
  const usedResponse = await request(app)
    .post('/api/agent/enroll')
    .send({ key: used.enrollmentKey, ...metadata })
    .expect(400);
  expect(usedResponse.body.error.code).toBe('KEY_ALREADY_USED');
  for (const response of [unknown, expiredResponse, usedResponse])
    noHashes(response.body);
});

it('allows exactly one of two parallel enrollment requests to succeed', async () => {
  const created = await service.createServer(ownerA, 'Parallel Server');
  const responses = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post('/api/agent/enroll')
        .send({ key: created.enrollmentKey, ...metadata }),
    ),
  );
  expect(responses.map((response) => response.status).sort()).toEqual([
    201, 400,
  ]);
  const winner = responses.find((response) => response.status === 201)!;
  const loser = responses.find((response) => response.status === 400)!;
  expect(loser.body.error.code).toBe('KEY_ALREADY_USED');
  const stored = await Server.findById(created.server.id)
    .select('+agentTokenHash')
    .orFail();
  expect(stored.agentTokenHash).toBe(sha256(winner.body.agentToken));
  responses.forEach((response) => noHashes(response.body));
});

it('isolates owners for listing, reading, and deleting; owner deletion also removes keys', async () => {
  const own = await service.createServer(ownerA, 'A Server');
  const other = await service.createServer(ownerB, 'B Server');
  const list = await request(app)
    .get('/api/servers')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(200);
  expect(list.body.servers.map((server: { id: string }) => server.id)).toEqual([
    own.server.id,
  ]);
  for (const method of ['get', 'delete'] as const) {
    const response = await request(app)
      [method](`/api/servers/${other.server.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Server not found' },
    });
  }
  expect(await Server.findById(other.server.id)).not.toBeNull();
  expect(
    await EnrollmentKey.countDocuments({ serverId: other.server.id }),
  ).toBe(1);
  await request(app)
    .delete(`/api/servers/${other.server.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(204);
  expect(await Server.findById(other.server.id)).toBeNull();
  expect(
    await EnrollmentKey.countDocuments({ serverId: other.server.id }),
  ).toBe(0);
  await request(app)
    .get(`/api/servers/${other.server.id}`)
    .set('Authorization', `Bearer ${tokenB}`)
    .expect(404);
  const enroll = await request(app)
    .post('/api/agent/enroll')
    .send({ key: other.enrollmentKey, ...metadata })
    .expect(400);
  expect(enroll.body.error.code).toBe('INVALID_KEY');
});

it('requires user authentication and validates IDs, names, queries, and enrollment fields', async () => {
  await request(app).get('/api/servers').expect(401);
  await request(app).post('/api/servers').send({ name: 'Server' }).expect(401);
  await request(app).get(`/api/servers/${ownerA}`).expect(401);
  await request(app).delete(`/api/servers/${ownerA}`).expect(401);
  for (const name of ['', 'a', 'a'.repeat(61)]) {
    const response = await request(app)
      .post('/api/servers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }
  for (const method of ['get', 'delete'] as const) {
    const response = await request(app)
      [method]('/api/servers/not-an-id')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }
  await request(app)
    .get('/api/servers?owner=someone')
    .set('Authorization', `Bearer ${tokenA}`)
    .expect(400);
  for (const body of [
    {},
    { ...metadata, key: 'key', ip: 'not-an-ip' },
    { ...metadata, key: 'key', hostname: '' },
    { ...metadata, key: 'key', os: 123 },
    { ...metadata, key: 'key', agentVersion: '' },
  ]) {
    const response = await request(app)
      .post('/api/agent/enroll')
      .send(body)
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  }
});

it('agentAuth rejects absent, malformed and wrong tokens and attaches the enrolled server', async () => {
  const protectedApp = express();
  protectedApp.get('/protected', agentAuth, (req, res) =>
    res.json({ server: req.server }),
  );
  protectedApp.use(errorHandler);
  for (const authorization of [undefined, 'Basic wrong', 'Bearer wrong']) {
    const pending = request(protectedApp).get('/protected');
    if (authorization) pending.set('Authorization', authorization);
    const response = await pending.expect(401);
    expect(response.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }
  const created = await service.createServer(ownerA, 'Agent Auth Server');
  const enrollment = await service.enrollAgent({
    key: created.enrollmentKey,
    ...metadata,
  });
  const response = await request(protectedApp)
    .get('/protected')
    .set('Authorization', `Bearer ${enrollment.agentToken}`)
    .expect(200);
  expect(response.body.server._id).toBe(created.server.id);
  noHashes(response.body);
  await service.deleteServer(ownerA, created.server.id);
  await request(protectedApp)
    .get('/protected')
    .set('Authorization', `Bearer ${enrollment.agentToken}`)
    .expect(401);
});

it('enforces the configured enrollment rate limit', async () => {
  const previous = env.ENROLL_RATE_LIMIT_MAX;
  env.ENROLL_RATE_LIMIT_MAX = 2;
  const limited = express();
  limited.use(express.json());
  limited.use('/api/agent', createAgentRouter());
  limited.use(errorHandler);
  env.ENROLL_RATE_LIMIT_MAX = previous;
  await request(limited).post('/api/agent/enroll').send({}).expect(400);
  await request(limited).post('/api/agent/enroll').send({}).expect(400);
  const response = await request(limited)
    .post('/api/agent/enroll')
    .send({})
    .expect(429);
  expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  expect(response.headers['retry-after']).toBeDefined();
  noHashes(response.body);
});

it('services enforce ownership independently of HTTP middleware', async () => {
  const created = await service.createServer(ownerB, 'Service Server');
  expect(await service.listServers(ownerA)).toEqual([]);
  await expect(
    service.getServer(ownerA, created.server.id),
  ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  await expect(
    service.deleteServer(ownerA, created.server.id),
  ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  expect(await service.getServer(ownerB, created.server.id)).toMatchObject({
    id: created.server.id,
  });
});

it('generates random secrets and compares SHA-256 hashes safely', () => {
  const first = generateSecret();
  expect(first).toHaveLength(64);
  expect(generateSecret()).not.toBe(first);
  expect(generateSecret(16)).toHaveLength(32);
  expect(sha256('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  expect(compareHashes(sha256(first), sha256(first))).toBe(true);
  expect(compareHashes(sha256(first), sha256('other'))).toBe(false);
  expect(compareHashes('bad', sha256(first))).toBe(false);
  expect(compareHashes('z'.repeat(64), sha256(first))).toBe(false);
});
