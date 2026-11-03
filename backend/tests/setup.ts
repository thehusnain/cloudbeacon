import { afterAll, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Never load .env or inherit a developer's MongoDB URI in tests.
process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.ENROLL_RATE_LIMIT_MAX = '1000';
process.env.PORT = '5000';
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/test-unavailable';

const mongo = await MongoMemoryServer.create();
process.env.MONGO_URI = mongo.getUri('cloud-beacon-test');
const { connectDb, disconnectDb } = await import('../src/config/db.js');

beforeAll(async () => {
  await connectDb();
});

afterAll(async () => {
  try {
    await disconnectDb();
  } finally {
    await mongo.stop();
  }
});
