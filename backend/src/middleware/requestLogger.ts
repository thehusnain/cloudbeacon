import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = performance.now();
  res.on('finish', () => {
    // Omit query strings, headers and bodies, which may contain credentials.
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.route?.path ?? '[unmatched]',
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
      }),
    );
  });
  next();
};
