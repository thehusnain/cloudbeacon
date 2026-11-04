import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/authValidation.js';
import { validateEmptyBody } from '../middleware/serverValidation.js';
import {
  incidentQuery,
  incidentId,
  incidentPatch,
} from '../middleware/incidentValidation.js';
import * as controller from '../controllers/incidentController.js';
const router = Router();
router.use(requireAuth);
router.get('/', incidentQuery, validateEmptyBody, controller.list);
router.get('/:id', incidentId, validateEmptyBody, controller.get);
router.get('/:id/timeline', incidentId, validateEmptyBody, controller.timeline);
router.patch('/:id', incidentId, validateBody(incidentPatch), controller.patch);
export default router;
