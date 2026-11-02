import request from 'supertest';
import { expect, it } from 'vitest';
import { app } from '../src/app.js';

it('GET /api/health returns an ok status', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect('Content-Type', /json/)
    .expect(200);

  expect(response.body).toEqual({ status: 'ok' });
});
