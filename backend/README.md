# Cloud Beacon backend

Node.js, strict TypeScript, Express and MongoDB API for Cloud Beacon. Detection, incident descriptions and summaries use rules and text templates.

## Requirements and setup

Use Node.js 22 or newer (Node 24 supported), npm, and MongoDB 7 or newer. No frontend build is required.

From the repository root, start local MongoDB:

```sh
docker compose up -d mongo
cd backend
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set `JWT_SECRET` to the generated value. Set `MONGO_URI` to match the credentials configured in the root `docker-compose.yml`; the local URI must include `authSource=admin`. Do not commit `.env` or Firebase service-account JSON files. Change the development database password before using a shared environment.

```sh
npm run dev
```

The backend connects to MongoDB, seeds default rules idempotently, attaches Socket.IO and starts the offline job before listening on port 5000. Health is available at `http://localhost:5000/api/health`. Invalid required configuration stops startup with field validation errors. Missing optional Firebase credentials leave the API working and disable push with one warning.

## Environment variables

| Variable                        | Default         | Purpose                                                                               |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `PORT`                          | `5000`          | HTTP listening port                                                                   |
| `MONGO_URI`                     | Required        | MongoDB connection URI; local Docker authentication uses `authSource=admin`           |
| `JWT_SECRET`                    | Required        | At least 32 characters; signs user JWTs                                               |
| `CLIENT_URL`                    | Required        | Exact HTTP(S) browser origin, e.g. `http://localhost:5173`, without trailing slash    |
| `NODE_ENV`                      | `development`   | `development`, `test`, or `production`                                                |
| `AUTH_RATE_LIMIT_MAX`           | `10`            | Shared login/register requests per IP per 15 minutes; `0` disables                    |
| `ENROLL_RATE_LIMIT_MAX`         | `10`            | Enrollment requests per IP per 15 minutes; `0` disables                               |
| `AGENT_RATE_LIMIT_MAX`          | `1000`          | Agent requests per IP per 15 minutes, including enrollment; `0` disables              |
| `OFFLINE_CHECK_INTERVAL_MS`     | `30000`         | Offline check interval, minimum 1000ms                                                |
| `OFFLINE_THRESHOLD_SECONDS`     | `90`            | Silence before an online server becomes offline                                       |
| `INCIDENT_WINDOW_MINUTES`       | `30`            | Incident grouping window                                                              |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Empty, optional | Firebase service-account JSON path, relative to process working directory or absolute |

The general HTTP limiter allows 100 requests per IP per 15 minutes. Agent paths use the separate agent limiter. Limits are in memory per process. Proxy trust is disabled; configure a trusted proxy deployment deliberately before exposing multiple instances, so IP limits remain meaningful. Use HTTPS in production. Socket.IO accepts the configured browser origin and verifies JWTs before joining private rooms.

## Scripts

| Command            | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Watch TypeScript with tsx; loads `.env` if present |
| `npm run build`    | Compile `src/` to `dist/`                          |
| `npm start`        | Run `dist/server.js`; loads `.env` if present      |
| `npm test`         | Run Vitest once                                    |
| `npm run lint`     | Run ESLint                                         |
| `npm run format`   | Format backend files with Prettier                 |
| `npx tsc --noEmit` | Check production TypeScript without emitting files |

Production build and tests:

```sh
npm run build
npm start
# In a separate terminal:
npm test && npx tsc --noEmit
```

Tests start their own `mongodb-memory-server` MongoDB instance and replace `MONGO_URI`. They never use the Docker database; allow local process/socket creation and the MongoDB binary download on first use. Firebase is mocked in push tests. Socket tests use a mocked Socket.IO server; lifecycle tests also exercise real HTTP/Engine.IO startup and shutdown.

## Folder structure

```text
src/
  config/       Environment, database, shared agent policy
  controllers/  Thin HTTP handlers
  jobs/         Offline detection and timer lifecycle
  middleware/   Authentication, Zod validation, security, errors, rate limits
  models/       Mongoose schemas and indexes
  realtime/     Socket.IO authentication, private rooms, safe emission
  routes/       API route registration
  services/     Auth, enrollment, ingestion, alerts, incidents, commands, push, stats
  types/        Express request declarations
  utils/        Shared errors, crypto, event schemas, scalar query parsing
  app.ts        Express app without timers or listening sockets
  server.ts     Startup and graceful shutdown
 tests/         Vitest, Supertest, isolated MongoDB setup
 tools/fake-agent/index.mjs  Dependency-free agent simulator
```

## API endpoints

All paths below are relative to `/api`. User authentication uses `Authorization: Bearer <JWT>`; agent authentication uses `Authorization: Bearer <agentToken>`. All user data is restricted to servers owned by that user. Other owners' identifiers return 404; unfiltered lists contain only owned records. Unknown fields, malformed IDs, invalid scalar query values and invalid request bodies return validation errors.

| Method | Path                                   | Authentication | Purpose                   |
| ------ | -------------------------------------- | -------------- | ------------------------- |
| GET    | `/health`                              | Public         | Health                    |
| POST   | `/auth/register`                       | Public         | Register                  |
| POST   | `/auth/login`                          | Public         | Login                     |
| GET    | `/auth/me`                             | User JWT       | Current user              |
| POST   | `/servers`                             | User JWT       | Create server             |
| GET    | `/servers`                             | User JWT       | List servers              |
| GET    | `/servers/{{serverId}}`                | User JWT       | Get server                |
| DELETE | `/servers/{{serverId}}`                | User JWT       | Delete server             |
| POST   | `/servers/{{serverId}}/block-ip`       | User JWT       | Block IP                  |
| POST   | `/servers/{{serverId}}/unblock-ip`     | User JWT       | Unblock IP                |
| GET    | `/servers/{{serverId}}/commands`       | User JWT       | List commands             |
| POST   | `/agent/enroll`                        | Public         | Enroll                    |
| POST   | `/agent/heartbeat`                     | Agent token    | Heartbeat                 |
| POST   | `/agent/events`                        | Agent token    | Ingest events             |
| GET    | `/agent/rules`                         | Agent token    | Get rules                 |
| POST   | `/agent/commands/{{commandId}}/result` | Agent token    | Report command result     |
| GET    | `/events`                              | User JWT       | List events               |
| GET    | `/alerts`                              | User JWT       | List alerts               |
| GET    | `/alerts/{{alertId}}`                  | User JWT       | Get alert                 |
| PATCH  | `/alerts/{{alertId}}`                  | User JWT       | Update alert              |
| GET    | `/incidents`                           | User JWT       | List incidents            |
| GET    | `/incidents/{{incidentId}}`            | User JWT       | Get incident with summary |
| GET    | `/incidents/{{incidentId}}/timeline`   | User JWT       | Get timeline              |
| PATCH  | `/incidents/{{incidentId}}`            | User JWT       | Update incident           |
| POST   | `/devices/register`                    | User JWT       | Register device           |
| DELETE | `/devices/{{deviceTokenEncoded}}`      | User JWT       | Delete device             |
| GET    | `/stats/overview`                      | User JWT       | Overview                  |
| GET    | `/stats/events-over-time`              | User JWT       | Events over time          |

The exact agent exchange is defined in `../docs/api-contract.md`. Import `../docs/cloud-beacon.postman_collection.json` into Postman for example requests covering every HTTP endpoint. Set the empty credential variables locally; register/login and enrollment scripts store returned credentials locally. Clear credentials before exporting a collection.

### Filters, pagination and responses

- Events: `serverId`, `type`, `severity`, `sourceIp`, `from`, `to`; ISO timestamps for date filters.
- Alerts: `serverId`, `status` (`open`, `acknowledged`, `resolved`), `severity`.
- Incidents: `serverId`, `status` (`open`, `closed`), `severity`.
- Commands: `status` (`pending`, `delivered`, `done`, `failed`).
- Paginated lists accept `page` (default 1) and `limit` (default 25, max 100), returning `{ items, page, limit, total }`. Server lists return `{ servers }`.
- Statistics overview counts open alerts by severity and events in the past 24 hours. Event buckets accept `hours` (1–168, default 24), use UTC, include the current partial hour, and fill empty hours with zero.
- Incident detail returns `{ incident }` with a summary computed on read. Timeline returns `{ steps }`, oldest first, capped at 500 steps; long consecutive SSH-failure runs collapse with at most 50 raw evidence events.
- Device registration uses `{ token }`; a maximum of 10 distinct tokens is retained. URL-encode tokens in DELETE paths.
- Block commands default to 3600 seconds, maximum 604800. Allowlisted and server-owned IPs cannot be blocked. Pending duplicates return the existing command. Heartbeat delivers pending commands and retries unreported deliveries after 5 minutes.
- Auth responses intentionally return a JWT. Server creation returns an enrollment key once; enrollment returns an agent token once. Passwords, credential hashes, device token arrays and nested credential fields are excluded from JSON responses. Nested event details with reserved credential field names are redacted on output; stored evidence remains unchanged.

Every HTTP error uses:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message" } }
```

Rate limits return 429 with `Retry-After`; unknown errors return a generic 500 without a stack trace. Health returns 503 when MongoDB is disconnected. Requests are logged by route template, status and elapsed time, without headers, bodies, query strings or actual URL token values.

### Realtime and push

Connect Socket.IO to the backend origin with `auth: { token: userJwt }`. Each authenticated socket joins a server-managed `user:<id>` room. The backend emits `alert:new`, `alert:updated`, batched `event:new`, and `server:status` to the server owner only. New high/critical alerts can trigger asynchronous Firebase multicast pushes; updates do not repeat pushes. Invalid Firebase tokens are removed. Missing credentials or push failures do not fail ingestion.

### Shutdown and local simulation

SIGINT/SIGTERM stops scheduling offline checks, closes Socket.IO/HTTP connections, waits for an active offline check, and disconnects MongoDB. A 10-second deadline terminates stuck shutdowns. Database cleanup is attempted even when another shutdown step fails.

The fake agent is available at `tools/fake-agent/index.mjs`. Start with:

```sh
node tools/fake-agent/index.mjs enroll --url http://localhost:5000/api --key YOUR_ONE_TIME_KEY
node tools/fake-agent/index.mjs heartbeat
node tools/fake-agent/index.mjs simulate resend
```

It saves agent credentials locally in its ignored state file. Treat that file as a secret.
