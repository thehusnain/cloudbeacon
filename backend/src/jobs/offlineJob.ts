import { env } from '../config/env.js';
import { Server } from '../models/Server.js';
import { emitToUser } from '../realtime/socket.js';

export async function checkOfflineServers(
  now: Date = new Date(),
  thresholdSeconds: number = env.OFFLINE_THRESHOLD_SECONDS,
): Promise<number> {
  const cutoff = new Date(now.getTime() - thresholdSeconds * 1000);
  const stale = await Server.find({
    status: 'online',
    lastHeartbeat: { $lt: cutoff },
  })
    .select('_id owner lastHeartbeat')
    .lean();
  let changed = 0;
  for (const item of stale) {
    try {
      const updated = await Server.findOneAndUpdate(
        { _id: item._id, status: 'online', lastHeartbeat: { $lt: cutoff } },
        { $set: { status: 'offline' } },
        { returnDocument: 'after' },
      )
        .select('status lastHeartbeat')
        .lean();
      if (!updated) continue;
      changed += 1;
      try {
        emitToUser(String(item.owner), 'server:status', {
          serverId: String(item._id),
          status: 'offline',
          lastHeartbeat: updated.lastHeartbeat,
        });
      } catch (error) {
        console.error('Realtime server status emission failed', error);
      }
    } catch (error) {
      console.error('Offline server update failed', error);
    }
  }
  return changed;
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
