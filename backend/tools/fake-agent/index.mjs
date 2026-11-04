#!/usr/bin/env node
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(directory, '.agent-state.json');
const args = process.argv.slice(2);
const command = args[0];

function option(name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}

function safeBody(value) {
  if (Array.isArray(value)) return value.map(safeBody);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      key.toLowerCase().includes('token') && typeof item === 'string'
        ? `${item.slice(0, 6)}… [redacted]`
        : safeBody(item),
    ]));
  }
  return value;
}

function printResponse(label, status, body) {
  console.log(`${label} — HTTP ${status}`);
  console.log(JSON.stringify(safeBody(body), null, 2));
}

async function request(url, { token, body } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = { message: await response.text().catch(() => 'Non-JSON response') };
  }
  return { status: response.status, body: data };
}

async function send(url, endpoint, body, token, label = endpoint) {
  const result = await request(`${url}${endpoint}`, { token, body });
  printResponse(label, result.status, result.body);
  if (!result.status || result.status >= 400) process.exitCode = 1;
  return result;
}

async function loadState() {
  try {
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    if (!state.url || !state.agentToken) throw new Error('invalid state');
    return state;
  } catch {
    throw new Error('Agent state is missing or invalid. Run enroll first: node index.mjs enroll --url http://localhost:5000/api --key <KEY>');
  }
}

function heartbeatBody() {
  return {
    timestamp: new Date().toISOString(),
    agentVersion: '0.1.0',
    stats: {
      cpuPercent: Number((Math.random() * 25).toFixed(1)),
      memoryMb: Math.floor(128 + Math.random() * 384),
      bufferedEvents: 0,
    },
  };
}

async function sendHeartbeat(state) {
  return send(state.url, '/agent/heartbeat', heartbeatBody(), state.agentToken, 'Heartbeat');
}

function event(type, severity, details, sourceIp = undefined, timestamp = new Date()) {
  return {
    eventId: randomUUID(),
    type,
    severity,
    ...(sourceIp ? { sourceIp } : {}),
    timestamp: timestamp.toISOString(),
    details,
  };
}

async function sendEvents(state, events, label = 'Events') {
  return send(state.url, '/agent/events', { events }, state.agentToken, label);
}

async function main() {
  if (command === 'enroll') {
    const url = option('--url', 'http://localhost:5000/api').replace(/\/$/, '');
    const key = option('--key');
    if (!key) throw new Error('Missing --key. Example: node index.mjs enroll --url http://localhost:5000/api --key <KEY>');
    const result = await request(`${url}/agent/enroll`, {
      body: { key, hostname: 'fake-agent-01', os: 'Ubuntu 24.04', ip: '203.0.113.10', agentVersion: '0.1.0' },
    });
    printResponse('Enroll', result.status, result.body);
    if (result.status < 200 || result.status >= 300 || !result.body.agentToken || !result.body.serverId) {
      process.exitCode = 1;
      return;
    }
    await writeFile(statePath, JSON.stringify({ serverId: result.body.serverId, agentToken: result.body.agentToken, url }, null, 2), { mode: 0o600 });
    console.log(`Enrollment state saved to ${statePath}; token: ${result.body.agentToken.slice(0, 6)}… [redacted]`);
    return;
  }

  const state = await loadState();
  if (command === 'heartbeat') {
    await sendHeartbeat(state);
    return;
  }
  if (command === 'run') {
    console.log(`Running fake agent for server ${state.serverId}; token ${state.agentToken.slice(0, 6)}… [redacted]. Press Ctrl+C to stop.`);
    await sendHeartbeat(state);
    const timer = setInterval(() => { void sendHeartbeat(state); }, 30_000);
    process.once('SIGINT', () => { clearInterval(timer); process.exit(0); });
    process.once('SIGTERM', () => { clearInterval(timer); process.exit(0); });
    return;
  }
  if (command !== 'simulate') throw new Error('Unknown command. See README.md for usage.');

  const scenario = args[1];
  if (scenario === 'ssh-brute-force') {
    for (let index = 0; index < 20; index += 1) {
      await sendEvents(state, [event('ssh_failed_login', 'medium', { user: `test-user-${index + 1}`, port: 22, method: 'password' }, '198.51.100.7')], `SSH failed login ${index + 1}/20`);
      if (index < 19) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return;
  }
  if (scenario === 'port-scan') {
    await sendEvents(state, [event('port_scan', 'high', { portsScanned: 100, windowSeconds: 10, scanType: 'tcp' }, '198.51.100.7')]);
    return;
  }
  if (scenario === 'file-change') {
    await sendEvents(state, [event('file_modified', 'high', { path: '/etc/ssh/sshd_config', oldHash: randomBytes(32).toString('hex'), newHash: randomBytes(32).toString('hex'), user: 'root' })]);
    return;
  }
  if (scenario === 'permission-change') {
    await sendEvents(state, [event('permission_changed', 'high', { path: '/etc/shadow', oldMode: '0640', newMode: '0666', user: 'root' })]);
    return;
  }
  if (scenario === 'offline') {
    const now = Date.now();
    const batch = Array.from({ length: 15 }, (_, index) => event(
      'system_log', 'low', { source: 'fake-agent', message: `Buffered offline event ${index + 1}` },
      undefined, new Date(now - 120_000 + Math.round(index * 120_000 / 14)),
    ));
    console.log('Created 15 buffered events spanning the last two minutes. Waiting five seconds before sending the batch.');
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const result = await sendEvents(state, batch, 'Offline batch');
    console.log(`Batch totals: accepted=${result.body.accepted ?? 0}, duplicates=${result.body.duplicates ?? 0}`);
    return;
  }
  if (scenario === 'resend') {
    const batch = [
      event('ssh_failed_login', 'medium', { user: 'root', port: 22, method: 'password' }, '198.51.100.7'),
      event('port_scan', 'high', { portsScanned: 20, windowSeconds: 5, scanType: 'tcp' }, '198.51.100.7'),
    ];
    await sendEvents(state, batch, 'First batch');
    await sendEvents(state, batch, 'Resent batch');
    return;
  }
  throw new Error('Unknown simulation. See README.md for available scenarios.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
