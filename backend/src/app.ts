import express from 'express';
import mongoose from 'mongoose';
import { applyCommonMiddleware } from './middleware/common.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import { createAuthRouter } from './routes/auth.js';

import { serverRouter } from './routes/servers.js';
import { createAgentRouter } from './routes/agent.js';

export const app = express();

applyCommonMiddleware(app);

app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'error',
    uptime: process.uptime(),
    db: connected ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', createAuthRouter());

app.use('/api/servers', serverRouter);
app.use('/api/agent', createAgentRouter());

app.use(notFoundHandler);
app.use(errorHandler);
