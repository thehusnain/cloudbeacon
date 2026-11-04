import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  validateAlertId,
  validateAlertPatch,
  validateAlertQuery,
} from '../middleware/alertValidation.js';
import * as controller from '../controllers/alertController.js';
const router = Router();
router.use(requireAuth);
router.get('/', validateAlertQuery, controller.list);
router.get('/:id', validateAlertId, controller.get);
router.patch('/:id', validateAlertId, validateAlertPatch, controller.patch);
export default router;
