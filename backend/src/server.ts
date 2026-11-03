import { createServer } from 'node:http';
import { app } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { startOfflineJob } from './jobs/offlineJob.js';

const server = createServer(app);
let shuttingDown = false;
let stopOfflineJob: (() => void) | undefined;

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Shutting down backend');
  stopOfflineJob?.();

  const timeout = setTimeout(() => {
    console.error('Shutdown timed out');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  timeout.unref();

  try {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await disconnectDb();
  } catch {
    console.error('Failed to shut down cleanly');
    exitCode = 1;
  } finally {
    clearTimeout(timeout);
    process.exitCode = exitCode;
  }
}

process.once('SIGINT', () => {
  void shutdown(0);
});
process.once('SIGTERM', () => {
  void shutdown(0);
});
server.on('error', () => {
  console.error('HTTP server failed');
  void shutdown(1);
});

try {
  await connectDb();
  if (shuttingDown) {
    await disconnectDb();
  } else {
    stopOfflineJob = startOfflineJob();
    server.listen(env.PORT, () => {
      console.log(`Cloud Beacon backend listening on port ${env.PORT}`);
    });
  }
} catch {
  console.error('Backend startup failed: could not connect to MongoDB');
  await shutdown(1);
}
