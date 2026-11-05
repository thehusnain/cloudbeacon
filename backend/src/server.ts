import { createServer } from 'node:http';
import { app } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { startOfflineJob } from './jobs/offlineJob.js';
import { seedDefaultRules } from './services/ruleSeed.js';
import { closeSocket, initSocket } from './realtime/socket.js';

const server = createServer(app);
let shuttingDown = false;
let stopOfflineJob: (() => Promise<void>) | undefined;

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Shutting down backend');
  const offlineStopped = stopOfflineJob?.();

  const timeout = setTimeout(() => {
    console.error('Shutdown timed out');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  timeout.unref();

  try {
    await closeSocket();
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await offlineStopped;
  } catch {
    console.error('Failed to shut down cleanly');
    exitCode = 1;
  } finally {
    try {
      await disconnectDb();
    } catch {
      console.error('Failed to disconnect MongoDB');
      exitCode = 1;
    }
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
  await seedDefaultRules();
  if (shuttingDown) {
    await disconnectDb();
  } else {
    initSocket(server);
    stopOfflineJob = startOfflineJob();
    server.listen(env.PORT, () => {
      console.log(`Cloud Beacon backend listening on port ${env.PORT}`);
    });
  }
} catch {
  console.error('Backend startup failed: could not connect to MongoDB');
  await shutdown(1);
}
