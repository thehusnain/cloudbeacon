import { Server, toPublicServer } from '../models/Server.js';
import { EnrollmentKey } from '../models/EnrollmentKey.js';
import { generateSecret, sha256 } from '../utils/crypto.js';
import { AppError } from '../utils/AppError.js';

const notFound = () => new AppError('Server not found', 404, 'NOT_FOUND');

export async function createServer(ownerId: string, name: string) {
  const enrollmentKey = generateSecret();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const server = await Server.create({ owner: ownerId, name });
  try {
    await EnrollmentKey.create({
      serverId: server._id,
      keyHash: sha256(enrollmentKey),
      expiresAt,
    });
  } catch (error) {
    await Server.deleteOne({ _id: server._id, owner: ownerId });
    throw error;
  }
  return { server: toPublicServer(server), enrollmentKey, expiresAt };
}

export async function listServers(ownerId: string) {
  const servers = await Server.find({ owner: ownerId }).sort({ createdAt: -1 });
  return servers.map(toPublicServer);
}

export async function getServer(ownerId: string, id: string) {
  const server = await Server.findOne({ _id: id, owner: ownerId });
  if (!server) throw notFound();
  return toPublicServer(server);
}

export async function deleteServer(ownerId: string, id: string): Promise<void> {
  const server = await Server.findOneAndDelete({ _id: id, owner: ownerId });
  if (!server) throw notFound();
  await EnrollmentKey.deleteMany({ serverId: server._id });
}

export interface EnrollmentInput {
  key: string;
  hostname: string;
  os: string;
  ip: string;
  agentVersion: string;
}

export async function enrollAgent({
  key,
  hostname,
  os,
  ip,
  agentVersion,
}: EnrollmentInput) {
  const keyHash = sha256(key);
  const now = new Date();
  // Claim the key in one database operation. Only the winning request can issue a token.
  const claimed = await EnrollmentKey.findOneAndUpdate(
    { keyHash, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { new: true },
  );
  if (!claimed) {
    const existing = await EnrollmentKey.findOne({ keyHash });
    if (!existing)
      throw new AppError('Invalid enrollment key', 400, 'INVALID_KEY');
    if (existing.expiresAt.getTime() <= Date.now())
      throw new AppError('Enrollment key has expired', 400, 'KEY_EXPIRED');
    if (existing.usedAt)
      throw new AppError(
        'Enrollment key has already been used',
        400,
        'KEY_ALREADY_USED',
      );
    throw new AppError('Invalid enrollment key', 400, 'INVALID_KEY');
  }

  const agentToken = generateSecret();
  const server = await Server.findOneAndUpdate(
    { _id: claimed.serverId, status: 'pending' },
    {
      $set: {
        agentTokenHash: sha256(agentToken),
        status: 'online',
        lastHeartbeat: new Date(),
        hostname,
        os,
        ip,
        agentVersion,
      },
    },
    { new: true, runValidators: true },
  );
  // Fail closed if the server was deleted or cannot be enrolled; never unconsume a key.
  if (!server) throw new AppError('Invalid enrollment key', 400, 'INVALID_KEY');
  return {
    serverId: server.id as string,
    agentToken,
    heartbeatIntervalSeconds: 30,
  };
}
