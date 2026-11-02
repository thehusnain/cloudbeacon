import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { applyCommonMiddleware } from '../src/middleware/common.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';

it('returns the standard 404 format', async () => {
  const response = await request(app).get('/missing').expect(404);
  expect(response.body).toEqual({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

it('returns known errors with their status and code', async () => {
  const testApp = express();
  testApp.get('/known', () => {
    throw new AppError('Invalid request', 400, 'BAD_REQUEST');
  });
  testApp.use(errorHandler);
  const response = await request(testApp).get('/known').expect(400);
  expect(response.body).toEqual({
    error: { code: 'BAD_REQUEST', message: 'Invalid request' },
  });
});

it('hides unexpected error details and stack traces, including in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  try {
    const testApp = express();
    testApp.get('/unexpected', async () => {
      throw new Error('secret database details');
    });
    testApp.use(errorHandler);
    const response = await request(testApp).get('/unexpected').expect(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  } finally {
    vi.unstubAllEnvs();
  }
});

it('normalizes malformed JSON errors', async () => {
  const response = await request(app)
    .post('/missing')
    .set('Content-Type', 'application/json')
    .send('{broken')
    .expect(400);
  expect(response.body).toEqual({
    error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
  });
});

it('enforces the 1mb JSON body limit', async () => {
  const response = await request(app)
    .post('/missing')
    .send({ data: 'x'.repeat(1024 * 1024) })
    .expect(413);
  expect(response.body).toEqual({
    error: {
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body exceeds the 1mb limit',
    },
  });
});

it('sets security headers and allows only CLIENT_URL for CORS', async () => {
  const allowed = await request(app)
    .get('/api/health')
    .set('Origin', 'http://localhost:5173')
    .expect(200);
  expect(allowed.headers['access-control-allow-origin']).toBe(
    'http://localhost:5173',
  );
  expect(allowed.headers['x-content-type-options']).toBe('nosniff');
  expect(allowed.headers['x-powered-by']).toBeUndefined();
  const denied = await request(app)
    .get('/api/health')
    .set('Origin', 'https://untrusted.example')
    .expect(403);
  expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  expect(denied.body).toEqual({
    error: { code: 'CORS_FORBIDDEN', message: 'Origin is not allowed' },
  });
});

it('returns the standard format when the global rate limit is exceeded', async () => {
  const testApp = express();
  applyCommonMiddleware(testApp);
  testApp.get('/limited', (_req, res) => {
    res.sendStatus(204);
  });
  testApp.use(errorHandler);
  const logger = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    for (let i = 0; i < 100; i++) {
      await request(testApp).get('/limited').expect(204);
    }
    const response = await request(testApp).get('/limited').expect(429);
    expect(response.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    });
    expect(response.headers['retry-after']).toBeDefined();
  } finally {
    logger.mockRestore();
  }
});
