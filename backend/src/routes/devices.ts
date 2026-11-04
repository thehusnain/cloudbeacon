import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  validateDeviceToken,
  validateDeviceTokenParam,
} from '../middleware/deviceValidation.js';
import * as controller from '../controllers/deviceController.js';

const router = Router();
router.use(requireAuth);
router.post('/register', validateDeviceToken, controller.register);
router.delete('/:token', validateDeviceTokenParam, controller.remove);

export default router;
