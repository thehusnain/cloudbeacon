import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  validateEmptyBody,
  validateEmptyQuery,
} from '../middleware/serverValidation.js';
import { validateStatsHours } from '../middleware/statsValidation.js';
import * as controller from '../controllers/statsController.js';
const router = Router();
router.use(requireAuth, validateEmptyBody);
router.get('/overview', validateEmptyQuery, controller.overview);
router.get('/events-over-time', validateStatsHours, controller.eventsOverTime);
export default router;
