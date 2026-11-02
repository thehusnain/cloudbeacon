import request from 'supertest';
import { expect, it } from 'vitest';
import { app } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/config/db.js';

it('GET /api/health reports a connected database', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect('Content-Type', /json/)
    .expect(200);
  expect(response.body).toEqual({
    status: 'ok',
    uptime: expect.any(Number),
    db: 'connected',
  });
  expect(response.body.uptime).toBeGreaterThanOrEqual(0);
});

it('GET /api/health reports a disconnected database', async () => {
  await disconnectDb();
  try {
    const response = await request(app).get('/api/health').expect(503);
    expect(response.body).toEqual({
      status: 'error',
      uptime: expect.any(Number),
      db: 'disconnected',
    });
  } finally {
    await connectDb();
  }
});
