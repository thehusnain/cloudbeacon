import type { ServerDocument } from '../models/Server.js';
import { getRulesVersion } from './alertService.js';

export async function recordHeartbeat(
  server: ServerDocument,
  body: {
    timestamp: string;
    agentVersion: string;
    stats: { cpuPercent: number; memoryMb: number; bufferedEvents: number };
  },
) {
  server.lastHeartbeat = new Date();
  server.status = 'online';
  server.agentVersion = body.agentVersion;
  server.stats = body.stats;
  await server.save();
  // TODO: include pending commands when command delivery is implemented.
  return {
    serverTime: new Date().toISOString(),
    rulesVersion: await getRulesVersion(),
    commands: [],
  };
}
