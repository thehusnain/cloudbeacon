import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getEvents } from '../controllers/eventController.js';
import { validateEventQuery } from '../middleware/eventValidation.js';
const router=Router();
router.get('/', requireAuth, validateEventQuery, getEvents);
export default router;
