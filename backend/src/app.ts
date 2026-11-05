import {
  validateEmptyBody,
  validateEmptyQuery,
} from './middleware/serverValidation.js';
import statsRouter from './routes/stats.js';
import incidentsRouter from './routes/incidents.js';
import express from 'express';
import mongoose from 'mongoose';
import { applyCommonMiddleware } from './middleware/common.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import { createAuthRouter } from './routes/auth.js';

import { serverRouter } from './routes/servers.js';
import eventsRouter from './routes/events.js';
import { createAgentRouter } from './routes/agent.js';
import alertsRouter from './routes/alerts.js';
import devicesRouter from './routes/devices.js';

export const app = express();

applyCommonMiddleware(app);

app.get('/api/health', validateEmptyQuery, validateEmptyBody, (_req, res) => {
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
app.use('/api/events', eventsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/stats', statsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
