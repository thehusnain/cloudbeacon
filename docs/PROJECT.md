# Cloud Beacon: PROJECT.md

> Single source of truth for all humans and AI tools working on this repo.
> Read this file before starting any task.

## 1. Project Summary

**Cloud Beacon** is a lightweight, rule-based security monitoring and incident-tracing platform for **Linux cloud servers**. It is built for small teams, startups, developers and individuals who have no dedicated security team.

A small agent runs on each Linux server, watches security events, checks them against predefined rules, blocks suspicious activity where possible, and sends evidence to a central backend. Users see everything on a web dashboard and receive alerts on a mobile app. A module called **Beacon Trace** rebuilds the story of each incident from saved evidence.

- **Detection is rule-based only. No AI or machine learning.**
- Project type: BS Computer Science Final Year Project
- Institution: Govt. Akhtar Nawaz Khan (Shaheed) Degree College, Haripur
- Session: 2023-2027
- Team: Husnain Fiaz (23611), Usman Khan (23626)
- Supervisor: **TO CONFIRM** (documents currently disagree: Dr. Abid Ali vs Sir Shahid Gillani)

## 2. Ownership (IMPORTANT)

| Area | Folder | Owner |
|---|---|---|
| Linux agent (Go) | `agent/` | Husnain. **Do NOT modify.** |
| Backend API + MongoDB | `backend/` | Usman |
| Web dashboard (React) | `dashboard/` | Usman |
| Mobile app (Flutter) | (separate) | Shared / later; backend provides push via FCM |
| Docs | `docs/` | Both |

Rules for any AI tool:
- Work only inside `backend/`, `dashboard/` and `docs/`.
- Never edit anything inside `agent/`.
- The API contract in `docs/api-contract.md` is the boundary between the agent and the backend. Do not change it silently; flag any needed change.

## 3. System Architecture

```
Linux Server                    Cloud Beacon Backend                 Users
┌──────────────────┐  events    ┌────────────────────────┐  alerts   ┌──────────────────┐
│ Cloud Beacon     │  +heartbeat│ Backend API (Node.js)  │ ────────► │ Web Dashboard    │
│ Agent (Go)       │ ─────────► │ MongoDB                │  events   │ (React)          │
│ - watch events   │  (HTTPS)   │ Alert Manager          │  timeline │                  │
│ - check rules    │            │ Incident Timeline      │           ├──────────────────┤
│ - block IPs      │ ◄───────── │ (Beacon Trace)         │ push alert│ Mobile App       │
│ - offline buffer │   rules,   │                        │ ────────► │ (Flutter) via FCM│
└──────────────────┘  commands  └────────────────────────┘           └──────────────────┘
```

Data flow:
1. Agent collects a security event and checks it against rules locally.
2. Agent may block / protect, and stores events locally if offline.
3. Agent sends events (in batches) and heartbeats to the backend over HTTPS.
4. Backend stores events, evaluates rules, creates alerts, groups alerts into incidents.
5. Backend pushes live updates to the dashboard (Socket.IO) and push notifications to mobile (Firebase Cloud Messaging).
6. Backend returns rules and pending commands (e.g. block IP) to the agent.

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Agent | Go (teammate's part) |
| Backend | Node.js 22 LTS, TypeScript, Express |
| Database | MongoDB with Mongoose |
| Validation | Zod |
| Auth | JWT (users), hashed opaque tokens (agents), bcrypt (passwords) |
| Realtime | Socket.IO |
| Push | firebase-admin (FCM) |
| Backend tests | Vitest + Supertest + mongodb-memory-server |
| Dashboard | React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, axios |
| Charts | recharts (ask before installing) |
| Mobile | Flutter |
| Test lab | Linux server + Kali Linux (authorized lab only) |

Do not add new libraries without asking.

## 5. Scope

### Included
- Linux servers only
- Events: SSH logins, system logs, port scans, ping scans, file changes, permission changes
- Rule-based detection and alerts
- Blocking a suspicious IP and protecting selected files (where supported and configured)
- Offline buffering in the agent and later sync
- Web dashboard and mobile notifications
- Beacon Trace incident timelines

### Not included
- Windows or macOS servers
- AI or machine learning
- Monitoring a whole network
- Replacing a full security team or guaranteeing every attack is detected

## 6. Functional Requirements

| ID | Requirement | Mainly owned by |
|---|---|---|
| FR-01 | The user can register and log in to the dashboard. | Backend + Dashboard |
| FR-02 | The user can add a Linux server using a temporary setup key; no PEM key required. | Backend + Dashboard |
| FR-03 | The agent monitors SSH logins and relevant system logs. | Agent (backend ingests) |
| FR-04 | The agent checks for port scans and ping scans using rules and available event data. | Agent (backend ingests) |
| FR-05 | The agent reports changes to selected files and their permissions. | Agent (backend ingests) |
| FR-06 | The system checks events against predefined rules and creates alerts. | Backend |
| FR-07 | Where configured and supported, the agent can block a suspicious IP and protect selected files. | Agent + Backend (commands) |
| FR-08 | The agent sends events and a heartbeat; when offline it saves events and sends them later. | Agent + Backend (ingestion) |
| FR-09 | The dashboard shows servers, events, alerts and their status. | Dashboard |
| FR-10 | The mobile app notifies the administrator about suspicious activity. | Backend (FCM) + Mobile |
| FR-11 | Beacon Trace uses stored evidence to show the order of events in an incident. | Backend + Dashboard |

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 Performance | The agent uses little CPU and memory. |
| NFR-02 Response time | Alerts reach the user within a few seconds when backend and network are available. |
| NFR-03 Security | Data between agent and backend is protected in transit (HTTPS). |
| NFR-04 Reliability | Events collected during connection loss are saved and sent later. Backend must accept buffered batches and be idempotent. |
| NFR-05 Usability | Dashboard and mobile app show alerts in plain, understandable language. |
| NFR-06 Platform | Linux servers only. |
| NFR-07 Detection method | Predefined rules only; no AI or ML. |

## 8. Server Onboarding Flow (key feature)

1. User registers and logs in to the dashboard.
2. User clicks **Add Server**. Backend creates a server in `pending` state and generates a one-time enrollment key (random, 32+ bytes, expires in 15 minutes). Only the **hash** is stored; the plain key is shown once.
3. Dashboard shows the key and the install command.
4. User installs the agent on the Linux server and enters the key.
5. Agent calls `POST /api/agent/enroll` with the key. Backend verifies the hash, expiry and unused state, marks the key used, issues a long-lived **agent token** (only its hash is stored), and sets the server to `online`.
6. Dashboard (polling or socket) shows **"Connection Successful"**.
7. Agent sends heartbeats and events using the agent token.

## 9. Data Model (MongoDB collections)

- **users**: name, email (unique, lowercase), passwordHash, fcmTokens[], createdAt
- **servers**: owner, name, hostname, os, ip, status (`pending|online|offline`), lastHeartbeat, agentTokenHash, agentVersion, stats (cpu, mem), createdAt
- **enrollmentKeys**: serverId, keyHash, expiresAt, usedAt
- **events**: serverId, eventId (unique per server), type, severity, sourceIp, timestamp, details (mixed), receivedAt
- **rules**: name, type, severity, conditions (threshold, windowSeconds, etc.), action (`alert|block`), enabled, scope (global or per server)
- **alerts**: serverId, ruleId, severity, title, plainDescription, status (`open|acknowledged|resolved`), eventIds[], sourceIp, createdAt
- **commands**: serverId, type (e.g. `block_ip`, `unblock_ip`), payload, status (`pending|delivered|done|failed`), createdAt
- **incidents** (Beacon Trace): serverId, title, severity, status (`open|closed`), sourceIps[], startedAt, lastActivityAt, alertIds[], eventIds[], summary

Required indexes: events `(serverId, timestamp)`, events `(serverId, sourceIp)`, events unique `(eventId, serverId)`, alerts `(serverId, status, createdAt)`, incidents `(serverId, status, lastActivityAt)`.

## 10. API Overview

All routes under `/api`. Error format everywhere:

```json
{ "error": { "code": "SOME_CODE", "message": "Human readable message" } }
```

**Public / user-facing (JWT)**
- `GET /health`
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `POST /servers`, `GET /servers`, `GET /servers/:id`, `DELETE /servers/:id`
- `POST /servers/:id/block-ip`, `POST /servers/:id/unblock-ip`
- `GET /events`
- `GET /alerts`, `GET /alerts/:id`, `PATCH /alerts/:id`
- `GET /incidents`, `GET /incidents/:id`, `GET /incidents/:id/timeline`, `PATCH /incidents/:id`
- `POST /devices/register`, `DELETE /devices/:token`

**Agent-facing (agent token)**
- `POST /agent/enroll` (public, uses enrollment key, rate limited)
- `POST /agent/heartbeat`
- `POST /agent/events` (batch, max 500, idempotent by eventId)
- `GET /agent/rules`

Exact request/response formats live in `docs/api-contract.md`. That file wins over this overview.

## 11. Default Detection Rules (seed data)

1. SSH brute force: 5 or more failed logins from one IP within 60 seconds
2. Port scan detected
3. Sensitive file changed
4. Permission change on a protected file
5. Root login

Alert descriptions must be written in plain language a non-expert can understand (NFR-05).

## 12. Beacon Trace

Groups related alerts and events into an **incident** and produces a readable timeline.

- Grouping: a new alert joins an open incident on the same server with the same sourceIp, or within a 30 minute window; otherwise a new incident starts.
- Incident severity = highest severity among its alerts.
- Timeline: chronologically ordered steps, each with timestamp, type, plain-language description, severity and the raw evidence event.
- Summary: generated by **rule-based text templates** (when it started, what happened, what was affected). **No AI.**

## 13. Security Requirements for Our Own Code

A security tool must itself be secure:
- Hash passwords with bcrypt. Store only hashes of enrollment keys and agent tokens.
- Validate every request body, query and param with Zod.
- Users can only access their own servers, events, alerts and incidents (owner checks everywhere).
- Rate limit login, register and enroll.
- Never commit secrets; use `.env`, keep `.env.example` updated.
- helmet, strict CORS (only the dashboard origin), JSON body size limit.
- Never leak stack traces or internal details in error responses.
- Same error message for wrong email and wrong password.

## 14. Coding Conventions

- TypeScript strict mode in backend and dashboard.
- Backend layout: `backend/src/{config,models,routes,controllers,services,middleware,jobs,utils}`. Controllers stay thin; logic goes in services.
- Dashboard layout: `dashboard/src/{pages,components,api,hooks,context,types}`.
- Every backend endpoint has tests. Tests must pass before a task is considered done.
- Dashboard pages must handle loading, empty and error states.
- Small commits, one feature per branch (`feat/<name>`), merge only when working.

## 15. Build Order

1. Scaffold backend and dashboard
2. Backend foundation (config, DB, middleware, health)
3. Auth (FR-01)
4. Servers and enrollment keys (FR-02)
5. Event ingestion and heartbeat (FR-03 to FR-05, FR-08)
6. Fake agent tool (`backend/tools/fake-agent/`) for testing without the real agent
7. Rules and alerts, block commands (FR-06, FR-07)
8. Realtime and push notifications (FR-10)
9. Beacon Trace backend (FR-11)
10. Dashboard: foundation, servers, events, alerts, overview
11. Dashboard: Beacon Trace page
12. Hardening, Docker, docs, final tests

## 16. Proposed Schedule (16 weeks, to be confirmed with supervisor)

| Task | Weeks |
|---|---|
| Requirements and planning | 1-2 |
| Linux agent and monitoring rules | 3-6 |
| Backend API and database | 3-7 |
| Web dashboard | 6-9 |
| Mobile app and notifications | 8-11 |
| Beacon Trace incident timeline | 9-12 |
| Integration and system testing | 12-14 |
| Fixes, report and final demo | 14-16 |

## 17. Testing and Evaluation

Authorized lab only: a Linux server running the agent and a Kali Linux machine as the attacker.

Scenarios: SSH password guessing, port scanning, file modification, permission modification, agent disconnect/reconnect with offline sync.

Metrics: alert delivery time, agent CPU and memory use, number of false alerts, blocking effectiveness, reliability of offline event delivery.

## 18. Definition of Done (per task)

- Requirement (FR/NFR id) is satisfied
- Input validated, owner checks in place
- Tests written and passing
- No secrets in code, `.env.example` updated if needed
- Works with the fake agent / real agent per the API contract
- Author can explain how it works (viva readiness)

## 19. Glossary

- **Agent**: Go program running on the monitored Linux server
- **Enrollment key**: one-time temporary key used to connect a server
- **Agent token**: long-lived secret issued after enrollment
- **Heartbeat**: periodic "I'm alive" message from the agent
- **Event**: one raw security observation
- **Alert**: an event (or group) that matched a rule
- **Incident**: a group of related alerts, shown as a Beacon Trace timeline
- **Command**: an instruction from backend to agent, e.g. block an IP

