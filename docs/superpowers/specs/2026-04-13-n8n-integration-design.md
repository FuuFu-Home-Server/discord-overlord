# n8n Integration Design

**Date:** 2026-04-13  
**Status:** Approved

## Overview

Bidirectional integration between the discord-overlord bot and n8n, both running on the same Docker homeserver. n8n can notify the bot of workflow events; Priestess can trigger n8n workflows autonomously or manually via slash command.

---

## Architecture

```
Discord
  ↕ (messages/interactions)
discord-overlord (bot process)
  ├── HTTP server :3001 (internal Docker network only)
  │     └── POST /webhook  ← n8n sends structured events here
  ├── Priestess tool: trigger_n8n_workflow  → n8n webhook URLs (from DB)
  └── /n8n slash command  → manage workflow registry in DB

n8n (same Docker network)
  ├── Calls http://discord-overlord:3001/webhook  (n8n → bot)
  └── Receives webhook calls from Priestess tool  (bot → n8n)

PostgreSQL (existing DB)
  └── n8n_workflows table: { id, name, webhook_url, description, created_at }
```

---

## Authentication

Both directions use a shared Bearer token stored as `N8N_WEBHOOK_SECRET` env var.

- **n8n → bot**: n8n sends `Authorization: Bearer <secret>`. The existing "Overlord" credential in n8n is currently Basic Auth — it will need to be updated to a Header Auth credential sending `Authorization: Bearer <secret>`
- **bot → n8n**: Priestess tool and `/n8n trigger` include the same header on outbound webhook calls

---

## n8n → Bot (Inbound)

### New file: `src/clients/webhook-server.ts`

A Node.js `http.createServer` that:
1. Validates `Authorization: Bearer <N8N_WEBHOOK_SECRET>`
2. Parses JSON body
3. Validates presence of `event` and `message` fields
4. Posts a Discord embed to `config.aiChannelId`
5. Returns `200 OK`, `400` (bad payload), or `401` (bad auth)

Launched from `src/index.ts` inside the `ClientReady` handler, receives `client` and `config` as arguments. Port configurable via `WEBHOOK_PORT` env var (default `3001`). No host port mapping needed — only reachable within the Docker internal network by n8n.

### Payload shape (n8n sends this)

```json
{
  "event": "log_activity_done",
  "title": "Activity Logged",
  "message": "3 tasks synced to Jira successfully.",
  "data": { "taskIds": ["abc", "def"] }
}
```

### Discord output

A Discord embed posted to the AI channel:
- **Title**: value of `title` (falls back to `event` if absent)
- **Description**: value of `message`
- **Footer**: `event` type + timestamp
- **Fields**: `data` rendered as compact JSON block if present

Priestess does **not** generate a conversational reply for these — they are system notifications, not chat messages.

---

## Bot → n8n (Outbound)

### Priestess tool: `trigger_n8n_workflow`

Added to `FUNCTION_DECLARATIONS` in `src/clients/priestess.ts`.

**Schema:**
```json
{
  "name": "trigger_n8n_workflow",
  "description": "Trigger a registered n8n workflow by name. Use when the user wants to run an automation, log activity, send a report, or any other workflow task.",
  "parameters": {
    "name": { "type": "string", "description": "Workflow name as registered in the bot" },
    "payload": { "type": "object", "description": "Optional data to pass to the workflow" }
  },
  "required": ["name"]
}
```

**Execution (`executeFunction`):**
1. Query `n8n_workflows` table for the given name
2. Return error if not found
3. POST to `webhook_url` with `Authorization: Bearer <N8N_WEBHOOK_SECRET>` and optional payload
4. Return `{ success: true, workflow: name }` or `{ error: "..." }`

Gemini uses the return value to confirm the action to the user naturally.

### `/n8n` slash command

New file: `src/commands/n8n/index.ts`

| Subcommand | Args | Auth | Description |
|---|---|---|---|
| `/n8n trigger` | `name`, optional `payload` (JSON string) | Any | Fire a workflow by name |
| `/n8n register` | `name`, `url`, optional `description` | Admin role | Add or update a workflow in registry |
| `/n8n list` | — | Any | List all registered workflows |

Uses the same admin role guard pattern as `docker`/`caddy` commands.

---

## Database

### New table: `n8n_workflows`

```sql
CREATE TABLE IF NOT EXISTS n8n_workflows (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  webhook_url TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Created in `src/clients/db.ts` alongside existing table inits (`ai_messages`, `ai_persona`, `ai_token_usage`).

---

## New Files

| File | Purpose |
|---|---|
| `src/clients/webhook-server.ts` | Inbound HTTP server for n8n events |
| `src/commands/n8n/index.ts` | `/n8n` slash command (trigger, register, list) |

## Modified Files

| File | Change |
|---|---|
| `src/clients/db.ts` | Add `n8n_workflows` table creation |
| `src/clients/priestess.ts` | Add `trigger_n8n_workflow` tool declaration and executor |
| `src/index.ts` | Start webhook server on `ClientReady` |
| `src/config.ts` | Add `webhookPort` and `n8nWebhookSecret` from env |
| `docker-compose.yml` / env | Add `N8N_WEBHOOK_SECRET`, `WEBHOOK_PORT` vars |

---

## Error Handling

- Inbound: non-2xx from Discord send → log error, still return `200` to n8n (prevents n8n retry loops)
- Outbound: n8n webhook non-2xx → return error string to Gemini, Priestess reports failure to user
- Unknown workflow name → return clear error to Gemini before attempting HTTP call
