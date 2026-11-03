import type { ServerDocument } from '../models/Server.js';

export async function recordHeartbeat(server: ServerDocument, body: { timestamp: string; agentVersion: string; stats: { cpuPercent: number; memoryMb: number; bufferedEvents: number } }) {
  server.lastHeartbeat = new Date();
  server.status = 'online';
  server.agentVersion = body.agentVersion;
  server.stats = body.stats;
  await server.save();
  // TODO: fetch the active rules version and pending commands when those features are implemented.
  return { serverTime: new Date().toISOString(), rulesVersion: 0, commands: [] };
}
