import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { Alert } from '../src/models/Alert.js';
import { Event } from '../src/models/Event.js';
import { Rule } from '../src/models/Rule.js';
import { Server as MonitorServer } from '../src/models/Server.js';
import { User } from '../src/models/User.js';
import { checkOfflineServers } from '../src/jobs/offlineJob.js';
import { seedDefaultRules } from '../src/services/ruleSeed.js';

const socketHarness = vi.hoisted(() => ({
  middleware: undefined as unknown,
  connection: undefined as unknown,
  emissions: [] as Array<{ room: string; name: string; payload: unknown }>,
}));

vi.mock('socket.io', () => ({
  Server: class {
    constructor() {}
    use(handler: unknown) {
      socketHarness.middleware = handler;
    }
    on(_event: string, handler: unknown) {
      socketHarness.connection = handler;
    }
    to(room: string) {
      return {
        emit: (name: string, payload: unknown) =>
          socketHarness.emissions.push({ room, name, payload }),
      };
    }
    close(callback?: () => void) {
      callback?.();
    }
  },
}));

const { closeSocket, emitToUser, initSocket } =
  await import('../src/realtime/socket.js');
const { ingestEvents } = await import('../src/services/eventService.js');

let userA: string;
let userB: string;
let tokenA: string;
let serverA: string;

beforeAll(async () => {
  await Promise.all([
    User.init(),
    MonitorServer.init(),
    Event.init(),
    Rule.init(),
    Alert.init(),
  ]);
  const [a, b] = await User.create([
    {
      name: 'Realtime A',
      email: 'realtime-a@example.com',
      passwordHash: 'unused',
    },
    {
      name: 'Realtime B',
      email: 'realtime-b@example.com',
      passwordHash: 'unused',
    },
  ]);
  userA = a.id;
  userB = b.id;
  tokenA = jwt.sign({ sub: userA }, env.JWT_SECRET, { expiresIn: '7d' });
});

beforeEach(async () => {
  await closeSocket();
  socketHarness.emissions.length = 0;
  await Promise.all([
    MonitorServer.deleteMany({}),
    Event.deleteMany({}),
    Alert.deleteMany({}),
    Rule.deleteMany({}),
  ]);
  await seedDefaultRules();
  const server = await MonitorServer.create({
    owner: userA,
    name: 'Realtime server',
    status: 'online',
    lastHeartbeat: new Date(),
  });
  serverA = server.id;
});

it('is a safe no-op before initialization', () => {
  expect(() => emitToUser(userA, 'test:event', {})).not.toThrow();
});

it('authenticates socket handshakes and joins the user room', async () => {
  initSocket(createServer());
  const middleware = socketHarness.middleware as (
    socket: {
      handshake: { auth: { token?: string } };
      data: Record<string, unknown>;
    },
    next: (error?: Error) => void,
  ) => void;
  const connection = socketHarness.connection as (socket: {
    data: Record<string, unknown>;
    join: (room: string) => void;
  }) => void;
  const validSocket = {
    handshake: { auth: { token: tokenA } },
    data: {},
    join: vi.fn(),
  };
  await new Promise<void>((resolve, reject) =>
    middleware(validSocket, (error) => (error ? reject(error) : resolve())),
  );
  connection(validSocket);
  expect(validSocket.join).toHaveBeenCalledWith(`user:${userA}`);
  for (const token of [undefined, 'invalid.jwt.token']) {
    const socket = { handshake: { auth: { token } }, data: {}, join: vi.fn() };
    const error = await new Promise<Error | undefined>((resolve) =>
      middleware(socket, resolve),
    );
    expect(error?.message).toBe('Authentication failed');
  }
  await closeSocket();
});

it('emits a new alert only to its server owner', async () => {
  initSocket(createServer());
  await ingestEvents(serverA, [
    {
      eventId: 'socket-alert-1',
      type: 'root_login',
      severity: 'high',
      timestamp: new Date().toISOString(),
      details: { user: 'root' },
    },
  ]);
  const alertEmissions = socketHarness.emissions.filter(
    ({ name }) => name === 'alert:new',
  );
  expect(alertEmissions).toHaveLength(1);
  expect(alertEmissions[0]).toMatchObject({
    room: `user:${userA}`,
    name: 'alert:new',
  });
  expect(alertEmissions[0].room).not.toBe(`user:${userB}`);
  expect(
    socketHarness.emissions.find(({ name }) => name === 'event:new')?.payload,
  ).toMatchObject({ serverId: serverA, count: 1 });
  await closeSocket();
});

it('emits server:status to the owner when the offline check changes a server', async () => {
  initSocket(createServer());
  await MonitorServer.updateOne(
    { _id: serverA },
    { lastHeartbeat: new Date('2020-01-01T00:00:00Z') },
  );
  expect(await checkOfflineServers(new Date('2020-01-01T00:02:00Z'), 90)).toBe(
    1,
  );
  expect(socketHarness.emissions).toContainEqual(
    expect.objectContaining({
      room: `user:${userA}`,
      name: 'server:status',
      payload: expect.objectContaining({
        serverId: serverA,
        status: 'offline',
      }),
    }),
  );
  await closeSocket();
});
