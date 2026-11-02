# Cloud Beacon: Agent Rules

Cloud Beacon is a host-based security monitoring system for Linux servers: Go agent → Node.js backend → React dashboard + Flutter app. Detection is rule-based only. No AI or ML.

Before any task, read `docs/PROJECT.md` and `docs/api-contract.md`.

## Ownership (critical)
- I own `backend/` and `dashboard/`. Work only inside `backend/`, `dashboard/` and `docs/`.
- The `agent/` folder belongs to my teammate. NEVER modify anything inside `agent/`.
- Do not edit `LICENSE`. Edit `README.md` only if I ask.

## Stack
- Backend: Node 22, TypeScript (strict), Express, Mongoose, Zod, JWT, bcrypt, Socket.IO, firebase-admin, Vitest + Supertest + mongodb-memory-server
- Dashboard: React, Vite, TypeScript (strict), Tailwind CSS, React Router, TanStack Query, axios

## Structure
- `backend/src/{config,models,routes,controllers,services,middleware,jobs,utils}`
- `dashboard/src/{pages,components,api,hooks,context,types}`
- Fake agent tool goes in `backend/tools/fake-agent/`

## Working rules
- Do only the task I give. Do not refactor or touch unrelated files.
- Do NOT add new libraries without asking me first.
- Do not change the API contract silently. If it must change, tell me and explain why.
- Keep controllers thin. Put logic in services.
- Make small, focused changes. Do not rewrite whole files unless asked.

## Security rules
- Validate every request body, query and param with Zod.
- Hash passwords with bcrypt. Store only HASHES of enrollment keys and agent tokens.
- Every user-facing endpoint must check ownership: users only see their own servers, events, alerts and incidents.
- Never hardcode secrets. Use `.env` and keep `backend/.env.example` updated.
- Never return password hashes, token hashes or stack traces.
- Use the same error message for wrong email and wrong password.

## Error format (always)
```json
{ "error": { "code": "SOME_CODE", "message": "Human readable message" } }
```

## Testing
- Write tests for every endpoint and service you add.
- Run the tests before saying you are done. Do not claim tests pass unless you ran them.

## Dashboard rules
- Every page handles loading, empty and error states.
- Alerts and incident descriptions use plain, non-expert language.
- Reuse the shared components (Button, Card, Badge, Table, Modal, Spinner, EmptyState) instead of duplicating UI.

## Git
- One feature per branch (`feat/<name>`). Small commits.
- Do not commit `.env`, `node_modules` or `dist`.

## End of every task, report
1. Files changed
2. How to run and test it
3. Anything unfinished or any assumption you made
