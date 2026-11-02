import express from 'express';

export const app = express();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});
