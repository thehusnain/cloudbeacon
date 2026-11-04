import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/authValidation.js';
import {
  createServerSchema,
  validateServerId,
  validateEmptyQuery,
  validateEmptyBody,
} from '../middleware/serverValidation.js';
import * as controller from '../controllers/serverController.js';
import * as commandController from '../controllers/commandController.js';
import {
  validateBlockCommand,
  validateCommandQuery,
  validateCommandServerId,
  validateUnblockCommand,
} from '../middleware/commandValidation.js';

export const serverRouter = Router();
serverRouter.use(requireAuth);
serverRouter.post(
  '/',
  validateEmptyQuery,
  validateBody(createServerSchema),
  controller.createServer,
);
serverRouter.get(
  '/',
  validateEmptyQuery,
  validateEmptyBody,
  controller.listServers,
);
serverRouter.get(
  '/:id',
  validateServerId,
  validateEmptyQuery,
  validateEmptyBody,
  controller.getServer,
);
serverRouter.delete(
  '/:id',
  validateServerId,
  validateEmptyBody,
  controller.deleteServer,
);
serverRouter.post(
  '/:id/block-ip',
  validateCommandServerId,
  validateEmptyQuery,
  validateBlockCommand,
  commandController.createBlockCommand,
);
serverRouter.post(
  '/:id/unblock-ip',
  validateCommandServerId,
  validateEmptyQuery,
  validateUnblockCommand,
  commandController.createUnblockCommand,
);
serverRouter.get(
  '/:id/commands',
  validateCommandServerId,
  validateCommandQuery,
  validateEmptyBody,
  commandController.getServerCommands,
);
