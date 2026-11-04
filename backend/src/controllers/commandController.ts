import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { getServer } from '../services/serverService.js';
import {
  createCommand,
  listCommands,
  reportResult,
} from '../services/commandService.js';

function identity(req: Parameters<RequestHandler>[0]) {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}

export const createBlockCommand: RequestHandler = async (req, res) => {
  const server = await getServer(identity(req), req.params.id as string);
  const command = await createCommand(
    server.id,
    'block_ip',
    { ip: req.body.ip, durationSeconds: req.body.durationSeconds ?? 3600 },
    'manual',
    identity(req),
  );
  res.status(201).json({ command });
};

export const createUnblockCommand: RequestHandler = async (req, res) => {
  const server = await getServer(identity(req), req.params.id as string);
  const command = await createCommand(
    server.id,
    'unblock_ip',
    { ip: req.body.ip },
    'manual',
    identity(req),
  );
  res.status(201).json({ command });
};

export const getServerCommands: RequestHandler = async (req, res) => {
  const server = await getServer(identity(req), req.params.id as string);
  res.json(await listCommands(server.id, res.locals.commandFilters));
};

export const postCommandResult: RequestHandler = async (req, res) => {
  if (!req.server)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  await reportResult(req.server.id, req.params.commandId as string, req.body);
  res.json({ ok: true });
};
