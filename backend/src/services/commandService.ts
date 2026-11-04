import { Types } from 'mongoose';
import { Command } from '../models/Command.js';
import { Server } from '../models/Server.js';
import { allowlistIps } from '../config/agentPolicy.js';
import { AppError } from '../utils/AppError.js';
import { ipAddressSchema } from '../utils/eventSchema.js';

export type CommandType = 'block_ip' | 'unblock_ip';
export type CommandSource = 'manual' | 'rule';
export interface CommandPayload {
  ip: string;
  durationSeconds?: number;
}

export async function createCommand(
  serverId: string,
  type: CommandType,
  payload: CommandPayload,
  source: CommandSource,
  createdBy?: string | null,
) {
  if (!ipAddressSchema.safeParse(payload.ip).success) {
    throw new AppError('Invalid IP address', 400, 'VALIDATION_ERROR');
  }
  const server = await Server.findById(serverId).select('ip').lean();
  if (!server) throw new AppError('Server not found', 404, 'NOT_FOUND');
  if (type === 'block_ip') {
    if (allowlistIps.includes(payload.ip))
      throw new AppError(
        'This IP address is allowlisted and cannot be blocked',
        400,
        'IP_ALLOWLISTED',
      );
    if (server.ip === payload.ip)
      throw new AppError(
        'A server cannot block its own IP address',
        400,
        'SERVER_IP_CANNOT_BE_BLOCKED',
      );
    const existing = await Command.findOne({
      serverId,
      type: 'block_ip',
      status: 'pending',
      'payload.ip': payload.ip,
    });
    if (existing) return existing;
  }
  try {
    return await Command.create({
      serverId,
      type,
      payload,
      source,
      createdBy: createdBy ?? null,
      status: 'pending',
    });
  } catch (error) {
    if (type === 'block_ip' && (error as { code?: number }).code === 11000) {
      const existing = await Command.findOne({
        serverId,
        type,
        status: 'pending',
        'payload.ip': payload.ip,
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function getPendingCommandsForHeartbeat(serverId: string) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 5 * 60 * 1000);
  const candidates = await Command.find({
    serverId,
    $or: [
      { status: 'pending' },
      { status: 'delivered', deliveredAt: { $lte: cutoff } },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();
  const commands = [];
  for (const candidate of candidates) {
    const eligible =
      candidate.status === 'pending'
        ? { _id: candidate._id, serverId, status: 'pending' as const }
        : {
            _id: candidate._id,
            serverId,
            status: 'delivered' as const,
            deliveredAt: { $lte: cutoff },
          };
    const updated = await Command.findOneAndUpdate(
      eligible,
      { $set: { status: 'delivered', deliveredAt: now } },
      { returnDocument: 'after' },
    ).lean();
    if (updated)
      commands.push({
        commandId: String(updated._id),
        type: updated.type,
        payload: updated.payload,
      });
  }
  return commands;
}

export async function reportResult(
  serverId: string,
  commandId: string,
  result: { status: 'done' | 'failed'; message?: string; timestamp?: string },
): Promise<void> {
  if (!Types.ObjectId.isValid(commandId))
    throw new AppError('Command not found', 404, 'NOT_FOUND');
  const command = await Command.findOneAndUpdate(
    { _id: commandId, serverId },
    {
      $set: {
        status: result.status,
        completedAt: result.timestamp ? new Date(result.timestamp) : new Date(),
        resultMessage: result.message ?? '',
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!command) throw new AppError('Command not found', 404, 'NOT_FOUND');
}

export async function listCommands(
  serverId: string,
  filters: {
    status?: 'pending' | 'delivered' | 'done' | 'failed';
    page: number;
    limit: number;
  },
) {
  const query = {
    serverId,
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [items, total] = await Promise.all([
    Command.find(query)
      .sort({ createdAt: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean(),
    Command.countDocuments(query),
  ]);
  return { items, page: filters.page, limit: filters.limit, total };
}
