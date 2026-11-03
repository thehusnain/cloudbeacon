import { env } from '../config/env.js';
import { Server } from '../models/Server.js';

export async function checkOfflineServers(
  now: Date = new Date(),
  thresholdSeconds: number = env.OFFLINE_THRESHOLD_SECONDS,
): Promise<number> {
  const cutoff = new Date(now.getTime() - thresholdSeconds * 1000);
  const result = await Server.updateMany(
    { status: 'online', lastHeartbeat: { $lt: cutoff } },
    { $set: { status: 'offline' } },
  );
  return result.modifiedCount;
}

export function startOfflineJob(
  options: {
    intervalMs?: number;
    thresholdSeconds?: number;
    check?: (now: Date, thresholdSeconds: number) => Promise<number>;
  } = {},
): () => void {
  const intervalMs = options.intervalMs ?? env.OFFLINE_CHECK_INTERVAL_MS;
  const thresholdSeconds =
    options.thresholdSeconds ?? env.OFFLINE_THRESHOLD_SECONDS;
  const check = options.check ?? checkOfflineServers;
  const timer = setInterval(() => {
    void check(new Date(), thresholdSeconds).catch((error: unknown) => {
      console.error('Offline server check failed', error);
    });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
