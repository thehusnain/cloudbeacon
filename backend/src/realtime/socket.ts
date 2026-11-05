import type { Server as HttpServer } from 'node:http';
import { Server, type Server as SocketServer } from 'socket.io';
import { env } from '../config/env.js';
import { authenticateUserToken } from '../middleware/auth.js';
import { Server as MonitorServer } from '../models/Server.js';

let io: SocketServer | undefined;

export function initSocket(httpServer: HttpServer): SocketServer {
  if (io) return io;
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, methods: ['GET', 'POST'] },
    allowRequest: (request, callback) =>
      callback(
        null,
        !request.headers.origin || request.headers.origin === env.CLIENT_URL,
      ),
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (typeof token !== 'string' || token.length === 0) {
        next(new Error('Authentication failed'));
        return;
      }
      const user = await authenticateUserToken(token);
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
  });
  return io;
}

export function emitToUser(
  userId: string,
  eventName: string,
  payload: unknown,
): void {
  try {
    io?.to(`user:${userId}`).emit(eventName, payload);
  } catch {
    console.error('Realtime event emission failed');
  }
}

export async function emitToServerOwner(
  serverId: string,
  eventName: string,
  payload: unknown,
): Promise<void> {
  try {
    const server = await MonitorServer.findById(serverId)
      .select('owner')
      .lean();
    if (server) emitToUser(String(server.owner), eventName, payload);
  } catch {
    console.error('Realtime owner lookup failed');
  }
}

export async function closeSocket(): Promise<void> {
  if (!io) return;
  const active = io;
  io = undefined;
  await new Promise<void>((resolve) => active.close(() => resolve()));
}
