import { beforeEach, expect, it, vi } from 'vitest';
import { Server } from '../src/models/Server.js';
import {
  checkOfflineServers,
  startOfflineJob,
} from '../src/jobs/offlineJob.js';
import { User } from '../src/models/User.js';

beforeEach(async () => {
  await Server.deleteMany({});
});

it('marks only online servers with stale heartbeats offline', async () => {
  const user = await User.create({
    name: 'Offline Test',
    email: 'offline@example.com',
    passwordHash: 'test',
  });
  const now = new Date('2026-11-03T12:00:00Z');
  const stale = await Server.create({
    owner: user._id,
    name: 'Stale Server',
    status: 'online',
    lastHeartbeat: new Date(now.getTime() - 91_000),
  });
  const fresh = await Server.create({
    owner: user._id,
    name: 'Fresh Server',
    status: 'online',
    lastHeartbeat: new Date(now.getTime() - 89_000),
  });
  const pending = await Server.create({
    owner: user._id,
    name: 'Pending Server',
    status: 'pending',
    lastHeartbeat: new Date(now.getTime() - 120_000),
  });

  expect(await checkOfflineServers(now, 90)).toBe(1);
  expect((await Server.findById(stale._id))?.status).toBe('offline');
  expect((await Server.findById(fresh._id))?.status).toBe('online');
  expect((await Server.findById(pending._id))?.status).toBe('pending');
});

it('runs on its configured interval and stops when requested', async () => {
  vi.useFakeTimers();
  const check = vi.fn(async () => 0);
  try {
    const stop = startOfflineJob({
      intervalMs: 1_000,
      thresholdSeconds: 45,
      check,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(check).toHaveBeenCalledTimes(2);
    expect(check.mock.calls[0][1]).toBe(45);
    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
