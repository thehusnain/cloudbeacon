import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import {
  deleteDeviceToken,
  registerDeviceToken,
} from '../services/deviceService.js';

function userId(req: Parameters<RequestHandler>[0]): string {
  if (!req.user)
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  return req.user.id;
}

export const register: RequestHandler = async (req, res) => {
  await registerDeviceToken(userId(req), req.body.token);
  res.json({ ok: true });
};

export const remove: RequestHandler = async (req, res) => {
  await deleteDeviceToken(userId(req), req.params.token as string);
  res.json({ ok: true });
};
