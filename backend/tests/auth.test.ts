import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { createAuthRouter } from '../src/routes/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import * as authService from '../src/services/authService.js';

const credentials = {
  name: 'Test User',
  email: 'user@example.com',
  password: 'Password123',
};
const invalidCredentials = {
  error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
};
const unauthorized = {
  error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
};

beforeAll(async () => {
  await User.init();
});
beforeEach(async () => {
  await User.deleteMany({});
});

it('registers with normalized fields, a cost-12 hash, and a seven-day JWT', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      ...credentials,
      name: '  Test User  ',
      email: '  USER@EXAMPLE.COM  ',
    })
    .expect(201);
  expect(response.body).toEqual({
    token: expect.any(String),
    user: {
      id: expect.any(String),
      name: credentials.name,
      email: credentials.email,
    },
  });
  expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  const stored = await User.findOne({ email: credentials.email })
    .select('+passwordHash')
    .orFail();
  expect(bcrypt.getRounds(stored.passwordHash)).toBe(12);
  expect(await bcrypt.compare(credentials.password, stored.passwordHash)).toBe(
    true,
  );
  expect(stored.fcmTokens).toEqual([]);
  expect(stored.createdAt).toBeInstanceOf(Date);
  expect(stored.updatedAt).toBeInstanceOf(Date);
  expect(stored.toJSON()).not.toHaveProperty('passwordHash');
  expect(await User.findById(stored._id)).not.toHaveProperty(
    'passwordHash',
    stored.passwordHash,
  );
  const payload = jwt.verify(response.body.token, env.JWT_SECRET) as JwtPayload;
  expect(payload.sub).toBe(stored.id);
  expect(payload.exp! - payload.iat!).toBe(7 * 24 * 60 * 60);
  expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
});

it('rejects duplicate email regardless of casing', async () => {
  await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  const response = await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, email: 'USER@EXAMPLE.COM' })
    .expect(409);
  expect(response.body).toEqual({
    error: { code: 'EMAIL_TAKEN', message: 'Email is already registered' },
  });
});

it.each([
  ['email', 'bad-email'],
  ['name', ' '],
  ['name', 'a'.repeat(61)],
  ['password', 'short1'],
  ['password', 'abcdefgh'],
  ['password', '12345678'],
  ['password', 'a1' + 'x'.repeat(71)],
  ['password', 'a1' + 'é'.repeat(36)],
])('rejects invalid register field %s', async (field, value) => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ ...credentials, [field]: value })
    .expect(400);
  expect(response.body).toEqual({
    error: { code: 'VALIDATION_ERROR', message: `Invalid fields: ${field}` },
  });
  expect(await User.countDocuments()).toBe(0);
});

it.each(['/register', '/login'])(
  'validates missing and wrongly typed bodies on %s',
  async (path) => {
    const response = await request(app)
      .post(`/api/auth${path}`)
      .send({ email: 123, password: null })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('email');
    expect(response.body.error.message).toContain('password');
    await request(app).post(`/api/auth${path}`).expect(400);
  },
);

it('logs in with normalized email and returns only public user fields', async () => {
  const registered = await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: ' USER@EXAMPLE.COM ', password: credentials.password })
    .expect(200);
  expect(response.body).toEqual({
    token: expect.any(String),
    user: registered.user,
  });
  expect(jwt.verify(response.body.token, env.JWT_SECRET)).toMatchObject({
    sub: registered.user.id,
  });
});

it('returns identical errors for wrong password and unknown email, using a dummy comparison', async () => {
  await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  const compare = vi.spyOn(bcrypt, 'compare');
  try {
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'Incorrect123' })
      .expect(401);
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'Incorrect123' })
      .expect(401);
    expect(wrong.body).toEqual(invalidCredentials);
    expect(unknown.body).toEqual(wrong.body);
    expect(compare).toHaveBeenCalledTimes(2);
    expect(bcrypt.getRounds(compare.mock.calls[1][1])).toBe(12);
  } finally {
    compare.mockRestore();
  }
});

it('returns only the authenticated user from /me', async () => {
  const registered = await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  await authService.register(
    'Another User',
    'another@example.com',
    credentials.password,
  );
  const response = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${registered.token}`)
    .expect(200);
  expect(response.body).toEqual({ user: registered.user });
});

it('rejects missing, malformed, expired, incorrectly signed, and invalid-subject tokens identically', async () => {
  const registered = await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  const tokens = [
    undefined,
    'not-a-jwt',
    jwt.sign({ sub: registered.user.id }, env.JWT_SECRET, { expiresIn: -1 }),
    jwt.sign({ sub: registered.user.id }, 'different-secret', {
      expiresIn: '7d',
    }),
    jwt.sign({ sub: 'invalid-id' }, env.JWT_SECRET, { expiresIn: '7d' }),
    jwt.sign({ sub: registered.user.id }, env.JWT_SECRET, {
      algorithm: 'HS384',
      expiresIn: '7d',
    }),
    jwt.sign({ sub: registered.user.id }, env.JWT_SECRET),
    jwt.sign({ sub: new Types.ObjectId().toString() }, env.JWT_SECRET, {
      expiresIn: '7d',
    }),
  ];
  for (const token of tokens) {
    const pending = request(app).get('/api/auth/me');
    if (token) pending.set('Authorization', `Bearer ${token}`);
    expect((await pending.expect(401)).body).toEqual(unauthorized);
  }
  const malformed = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Basic ${registered.token}`)
    .expect(401);
  expect(malformed.body).toEqual(unauthorized);
});

it('rejects a token after its user has been deleted', async () => {
  const registered = await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  await User.deleteMany({});
  const response = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${registered.token}`)
    .expect(401);
  expect(response.body).toEqual(unauthorized);
});

it('shares the configured limit across register/login without limiting /me', async () => {
  const registered = await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  const previous = env.AUTH_RATE_LIMIT_MAX;
  env.AUTH_RATE_LIMIT_MAX = 2;
  const limitedApp = express();
  limitedApp.use(express.json());
  limitedApp.use('/api/auth', createAuthRouter());
  limitedApp.use(errorHandler);
  env.AUTH_RATE_LIMIT_MAX = previous;
  await request(limitedApp).post('/api/auth/register').send({}).expect(400);
  await request(limitedApp).post('/api/auth/login').send({}).expect(400);
  const response = await request(limitedApp)
    .post('/api/auth/login')
    .send({})
    .expect(429);
  expect(response.body).toEqual({
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  });
  expect(response.headers['retry-after']).toBeDefined();
  await request(limitedApp).post('/api/auth/register').send({}).expect(429);
  await request(limitedApp)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${registered.token}`)
    .expect(200);
});

it('allows disabling the auth limiter through configuration', async () => {
  const previous = env.AUTH_RATE_LIMIT_MAX;
  env.AUTH_RATE_LIMIT_MAX = 0;
  const unlimitedApp = express();
  unlimitedApp.use(express.json());
  unlimitedApp.use('/api/auth', createAuthRouter());
  unlimitedApp.use(errorHandler);
  env.AUTH_RATE_LIMIT_MAX = previous;
  for (let index = 0; index < 11; index++) {
    await request(unlimitedApp).post('/api/auth/login').send({}).expect(400);
  }
});

it('services return safe users and standard login/duplicate errors', async () => {
  const registered = await authService.register(
    credentials.name,
    credentials.email,
    credentials.password,
  );
  const loggedIn = await authService.login(
    credentials.email,
    credentials.password,
  );
  expect(loggedIn.user).toEqual(registered.user);
  expect(loggedIn.user).not.toHaveProperty('passwordHash');
  await expect(
    authService.login(credentials.email, 'WrongPassword123'),
  ).rejects.toMatchObject({
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });
  await expect(
    authService.register(
      credentials.name,
      credentials.email,
      credentials.password,
    ),
  ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
});
