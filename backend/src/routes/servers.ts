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

export const serverRouter = Router();
serverRouter.use(requireAuth, validateEmptyQuery);
serverRouter.post(
  '/',
  validateBody(createServerSchema),
  controller.createServer,
);
serverRouter.get('/', validateEmptyBody, controller.listServers);
serverRouter.get(
  '/:id',
  validateServerId,
  validateEmptyBody,
  controller.getServer,
);
serverRouter.delete(
  '/:id',
  validateServerId,
  validateEmptyBody,
  controller.deleteServer,
);
