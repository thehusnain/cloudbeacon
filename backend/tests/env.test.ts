import { expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';

const valid = {
  MONGO_URI: 'mongodb://localhost/test?authSource=admin',
  JWT_SECRET: 'a'.repeat(32),
  CLIENT_URL: 'http://localhost:5173',
};

it('parses typed environment settings and defaults', () => {
  expect(parseEnv(valid)).toEqual({
    INCIDENT_WINDOW_MINUTES: 30,
    ...valid,
    PORT: 5000,
    AUTH_RATE_LIMIT_MAX: 10,
    ENROLL_RATE_LIMIT_MAX: 10,
    AGENT_RATE_LIMIT_MAX: 1000,
    OFFLINE_CHECK_INTERVAL_MS: 30_000,
    OFFLINE_THRESHOLD_SECONDS: 90,
    NODE_ENV: 'development',
  });
  expect(
    parseEnv({ ...valid, PORT: '6000', NODE_ENV: 'production' }).PORT,
  ).toBe(6000);
});

it.each([
  ['ENROLL_RATE_LIMIT_MAX', '-1'],
  ['ENROLL_RATE_LIMIT_MAX', 'abc'],
  ['AUTH_RATE_LIMIT_MAX', '-1'],
  ['AUTH_RATE_LIMIT_MAX', 'abc'],
  ['PORT', '0'],
  ['PORT', '65536'],
  ['PORT', 'abc'],
  ['MONGO_URI', 'https://localhost/test'],
  ['MONGO_URI', 'mongodb://'],
  ['JWT_SECRET', 'short'],
  ['CLIENT_URL', 'not-a-url'],
  ['CLIENT_URL', 'https://example.com/path'],
  ['NODE_ENV', 'invalid'],
])('rejects invalid %s without exposing its value', (key, value) => {
  expect(() => parseEnv({ ...valid, [key]: value })).toThrow(
    `Invalid environment configuration: ${key}:`,
  );
});

it('rejects missing required settings without leaking secrets', () => {
  expect(() => parseEnv({})).toThrow('Invalid environment configuration');
  try {
    parseEnv({ ...valid, JWT_SECRET: 'sensitive-value' });
  } catch (error) {
    expect(String(error)).not.toContain('sensitive-value');
  }
});
