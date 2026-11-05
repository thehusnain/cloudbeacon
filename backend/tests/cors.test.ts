import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { applyCommonMiddleware } from '../src/middleware/common.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { isAllowedOrigin } from '../src/config/cors.js';

it('allows exact-origin preflight with explicit methods and headers and logs the path', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const response = await request(app)
      .options('/api/auth/register')
      .set('Origin', env.CLIENT_URL)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      env.CLIENT_URL,
    );
    expect(response.headers['access-control-allow-methods'].split(',')).toEqual(
      ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    );
    expect(
      response.headers['access-control-allow-headers'].toLowerCase().split(','),
    ).toEqual(['content-type', 'authorization']);
    expect(response.headers.ratelimit).toBeUndefined();
    expect(
      log.mock.calls.some(
        ([line]) => JSON.parse(String(line)).path === '/api/auth/register',
      ),
    ).toBe(true);
  } finally {
    log.mockRestore();
  }
});
it('rejects other origins for HTTP and the shared socket policy', async () => {
  for (const origin of [
    'http://localhost:5174',
    'http://localhost:5173.evil.example',
    'null',
  ]) {
    const response = await request(app)
      .options('/api/auth/register')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .expect(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(isAllowedOrigin(origin)).toBe(false);
  }
  expect(isAllowedOrigin(env.CLIENT_URL)).toBe(true);
});
it('includes CORS headers on a real registration', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .set('Origin', env.CLIENT_URL)
    .send({
      name: 'CORS Test',
      email: 'cors-test@example.com',
      password: 'Password123',
    })
    .expect(201);
  expect(response.headers['access-control-allow-origin']).toBe(env.CLIENT_URL);
  expect(response.body.token).toEqual(expect.any(String));
});
it('handles preflight before an exhausted rate limiter and retains headers on 429', async () => {
  const testApp = express();
  applyCommonMiddleware(testApp);
  testApp.get('/limited', (_req, res) => res.sendStatus(204));
  testApp.use(errorHandler);
  for (let i = 0; i < 100; i++)
    await request(testApp).get('/limited').expect(204);
  const limited = await request(testApp)
    .get('/limited')
    .set('Origin', env.CLIENT_URL)
    .expect(429);
  expect(limited.headers['access-control-allow-origin']).toBe(env.CLIENT_URL);
  await request(testApp)
    .options('/limited')
    .set('Origin', env.CLIENT_URL)
    .set('Access-Control-Request-Method', 'GET')
    .expect(204);
});
