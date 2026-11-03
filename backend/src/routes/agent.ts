import { Router } from 'express';
import { validateBody } from '../middleware/authValidation.js';
import {
  enrollmentSchema,
  validateEmptyQuery,
} from '../middleware/serverValidation.js';
import { createEnrollmentLimiter } from '../middleware/enrollmentRateLimit.js';
import { enrollAgent } from '../controllers/serverController.js';

export function createAgentRouter() {
  const router = Router();
  router.post(
    '/enroll',
    createEnrollmentLimiter(),
    validateEmptyQuery,
    validateBody(enrollmentSchema),
    enrollAgent,
  );
  return router;
}
