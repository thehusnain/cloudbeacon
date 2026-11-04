# Fake agent

A dependency-free Node.js ESM client for exercising the agent API. Run it from this folder or pass the script path from the repository root. Enrollment state is saved in `.agent-state.json` with owner-only permissions and is excluded by the root `.gitignore`. Output redacts the agent token, showing only its first six characters.

The backend must be running at the selected URL. Enroll once first:

```sh
node index.mjs enroll --url http://localhost:5000/api --key YOUR_ENROLLMENT_KEY
```

Send one heartbeat:

```sh
node index.mjs heartbeat
```

Keep sending heartbeats every 30 seconds until Ctrl+C:

```sh
node index.mjs run
```

Send twenty failed SSH login events from one source IP, one per second:

```sh
node index.mjs simulate ssh-brute-force
```

Send one port scan:

```sh
node index.mjs simulate port-scan
```

Send one modified-file event for `/etc/ssh/sshd_config`:

```sh
node index.mjs simulate file-change
```

Send one permission-change event for `/etc/shadow`:

```sh
node index.mjs simulate permission-change
```

Create fifteen events across a two-minute offline period, wait five seconds, then send them in one batch:

```sh
node index.mjs simulate offline
```

Send a batch twice to demonstrate duplicate handling:

```sh
node index.mjs simulate resend
```

Enroll against another backend by changing `--url`. All event and heartbeat requests use the saved URL and bearer token.
