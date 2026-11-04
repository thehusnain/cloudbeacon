import type { ServerDocument } from '../models/Server.js';
import { getRulesVersion } from './alertService.js';
import { getPendingCommandsForHeartbeat } from './commandService.js';
import { emitToServerOwner } from '../realtime/socket.js';

export async function recordHeartbeat(
  server: ServerDocument,
  body: {
    timestamp: string;
    agentVersion: string;
    stats: { cpuPercent: number; memoryMb: number; bufferedEvents: number };
  },
) {
  const wasOnline = server.status === 'online';
  server.lastHeartbeat = new Date();
  server.status = 'online';
  server.agentVersion = body.agentVersion;
  server.stats = body.stats;
  await server.save();
  if (!wasOnline) {
    await emitToServerOwner(server.id, 'server:status', {
      serverId: server.id,
      status: 'online',
      lastHeartbeat: server.lastHeartbeat,
    });
  }
  return {
    serverTime: new Date().toISOString(),
    rulesVersion: await getRulesVersion(),
    commands: await getPendingCommandsForHeartbeat(server.id),
  };
}
