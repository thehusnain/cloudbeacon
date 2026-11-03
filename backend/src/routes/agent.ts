import { Router } from 'express';
import { validateBody } from '../middleware/authValidation.js';
import {
  enrollmentSchema,
  validateEmptyQuery,
} from '../middleware/serverValidation.js';
import { createEnrollmentLimiter } from '../middleware/enrollmentRateLimit.js';
import { agentAuth } from '../middleware/agentAuth.js';
import { createAgentLimiter } from '../middleware/agentRateLimit.js';
import { validateEventBatch, validateHeartbeat } from '../middleware/eventValidation.js';
import { postEvents, postHeartbeat } from '../controllers/eventController.js';
import { enrollAgent } from '../controllers/serverController.js';

export function createAgentRouter() {
  const router = Router();
  router.use(createAgentLimiter());
  router.post(
    '/enroll',
    createEnrollmentLimiter(),
    validateEmptyQuery,
    validateBody(enrollmentSchema),
    enrollAgent,
  );
  router.post('/events', agentAuth, validateEmptyQuery, validateEventBatch, postEvents);
  router.post('/heartbeat', agentAuth, validateEmptyQuery, validateHeartbeat, postHeartbeat);
  return router;
}
