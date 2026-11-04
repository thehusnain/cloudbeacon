import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';

let userId: string;
let token: string;
const auth = (value = token) => ({ Authorization: `Bearer ${value}` });

beforeAll(async () => {
  await User.init();
  const user = await User.create({
    name: 'Device User',
    email: 'device@example.com',
    passwordHash: 'unused',
  });
  userId = user.id;
  token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' });
});

beforeEach(async () => {
  await User.updateOne({ _id: userId }, { $set: { fcmTokens: [] } });
});

it('registers without duplicates, deletes tokens, and retains only the 10 newest', async () => {
  await request(app)
    .post('/api/devices/register')
    .set(auth())
    .send({ token: 'same-token' })
    .expect(200, { ok: true });
  await request(app)
    .post('/api/devices/register')
    .set(auth())
    .send({ token: 'same-token' })
    .expect(200, { ok: true });
  expect((await User.findById(userId).lean())?.fcmTokens).toEqual([
    'same-token',
  ]);
  for (let i = 0; i < 11; i++) {
    await request(app)
      .post('/api/devices/register')
      .set(auth())
      .send({ token: `token-${i}` })
      .expect(200);
  }
  const tokens = (await User.findById(userId).lean())?.fcmTokens ?? [];
  expect(tokens).toHaveLength(10);
  expect(tokens).not.toContain('same-token');
  expect(tokens).toContain('token-10');
  await request(app)
    .delete('/api/devices/token-10')
    .set(auth())
    .expect(200, { ok: true });
  expect((await User.findById(userId).lean())?.fcmTokens).not.toContain(
    'token-10',
  );
});

it('requires authentication and validates device token requests', async () => {
  await request(app)
    .post('/api/devices/register')
    .send({ token: 'valid' })
    .expect(401);
  await request(app).delete('/api/devices/valid').expect(401);
  await request(app)
    .post('/api/devices/register')
    .set(auth())
    .send({ token: '' })
    .expect(400);
  await request(app)
    .post('/api/devices/register')
    .set(auth())
    .send({ token: 'x'.repeat(4097) })
    .expect(400);
  await request(app)
    .post('/api/devices/register')
    .set(auth())
    .send({ token: 'valid', extra: true })
    .expect(400);
});
