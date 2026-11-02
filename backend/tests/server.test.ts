import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { expect, it } from 'vitest';

async function getFreePort(): Promise<number> {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((resolve, reject) => {
    reservation.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

it.each(['SIGINT', 'SIGTERM'] as const)(
  'connects before listening and shuts down on %s',
  async (signal) => {
    const port = await getFreePort();
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'src/server.ts'],
      {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    const exited = once(child, 'exit');
    let output = '';
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`Startup timed out: ${output}`)),
          10_000,
        );
        const onExit = () => {
          clearTimeout(timeout);
          reject(new Error(`Server exited before listening: ${output}`));
        };
        child.once('exit', onExit);
        child.stdout.on('data', (chunk) => {
          output += String(chunk);
          if (output.includes('backend listening')) {
            clearTimeout(timeout);
            child.off('exit', onExit);
            resolve();
          }
        });
      });
      expect(output.indexOf('MongoDB connected')).toBeGreaterThanOrEqual(0);
      expect(output.indexOf('MongoDB connected')).toBeLessThan(
        output.indexOf('backend listening'),
      );
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: 'ok',
        db: 'connected',
      });
      child.kill(signal);
      expect(await exited).toEqual([0, null]);
      expect(output).toContain('MongoDB disconnected');
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
  },
);
