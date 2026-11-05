import type { RequestHandler } from 'express';
const sensitive = new Set([
  'passwordhash',
  'keyhash',
  'agenttokenhash',
  'fcmtokens',
  'password',
  'authorization',
  'jwt_secret',
  'jwtsecret',
  'token',
  'tokens',
  'agenttoken',
  'enrollmentkey',
  'stack',
  'private_key',
  'privatekey',
]);
// Includes nested agent-provided details and lean MongoDB results. Issuance
// responses are the only places where a credential must be returned once.
export const responseSafety: RequestHandler = (req, res, next) => {
  const original = res.json.bind(res);
  res.json = (body) => {
    const path = `${req.baseUrl}${req.route?.path ?? ''}`;
    const allowed =
      req.method === 'POST'
        ? path === '/api/auth/register' || path === '/api/auth/login'
          ? 'token'
          : path === '/api/agent/enroll'
            ? 'agentToken'
            : path === '/api/servers' || path === '/api/servers/'
              ? 'enrollmentKey'
              : undefined
        : undefined;
    const root = body;
    const encoded = JSON.stringify(body, function (key, value) {
      if (
        sensitive.has(key.toLowerCase()) &&
        !(this === root && key === allowed)
      )
        return undefined;
      return value;
    });
    return original(encoded === undefined ? null : JSON.parse(encoded));
  };
  next();
};
