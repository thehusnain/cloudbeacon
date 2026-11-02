import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { createAuthLimiter } from '../middleware/authRateLimit.js';
import {
  loginSchema,
  registerSchema,
  validateBody,
} from '../middleware/authValidation.js';

export function createAuthRouter() {
  const router = Router();
  const limiter = createAuthLimiter();
  router.post(
    '/register',
    limiter,
    validateBody(registerSchema),
    controller.register,
  );
  router.post('/login', limiter, validateBody(loginSchema), controller.login);
  router.get('/me', requireAuth, controller.me);
  return router;
}
