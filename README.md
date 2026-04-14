# discord-overlord

A Discord bot that acts as a control plane for a personal homeserver. Manages Docker containers, monitors system stats, integrates with n8n automation workflows, tracks media bookmarks, and hosts **Priestess** — a persistent AI personal assistant powered by Gemini.

## Commands

### Docker Management

Requires the Docker admin role.

| Command | Description |
|---|---|
| `/docker list` | List all containers and their status |
| `/docker start <container>` | Start a stopped container |
| `/docker stop <container>` | Stop a running container |
| `/docker restart <container>` | Restart a container |
| `/docker logs <container> [lines]` | Fetch last N log lines (default 50, max 500) |
| `/docker status <container>` | Show detailed container status |
| `/docker pull <container>` | Pull latest image (restart to apply) |
| `/docker stats <container>` | Show CPU and memory usage |

Container names support autocomplete.

### System

| Command | Description |
|---|---|
| `/system` | Show host CPU load, memory, disk usage, and uptime |

Requires the Docker admin role.

### Caddy Reverse Proxy

| Command | Description |
|---|---|
| `/caddy` | List all reverse proxy routes and ping each upstream |

Requires the Docker admin role.

### Work Log

| Command | Description |
|---|---|
| `/worklog` | Open a modal to log a work task to the dashboard API |

Modal fields: summary (required), duration (required, e.g. `1h30m`), start date (pre-filled to today 09:00), description (optional multiline). Requires the worklog role.

### Bookmarks

Track reading/watching progress for manga, manhwa, manhua, anime, and novels.

| Command | Description |
|---|---|
| `/bookmark add` | Open a form to add a new bookmark |
| `/bookmark update <name>` | Update progress, status, or notes |
| `/bookmark delete <name>` | Remove a bookmark |

Bookmark operations are also available directly through Priestess in the AI channel.

### n8n Automation

| Command | Description |
|---|---|
| `/n8n list` | List all registered workflows |
| `/n8n trigger <name> [payload]` | Manually trigger a workflow with optional JSON payload |
| `/n8n register <name> <url> <desc>` | Register or update a workflow (admin only) |

Workflow names support autocomplete.

### Priestess AI

| Command | Description |
|---|---|
| `/ai clear` | Wipe conversation history (keeps persona) |
| `/ai history` | Show your last 10 messages with Priestess |
| `/ai persona` | Update Priestess's system prompt |
| `/ai usage` | Show token usage stats (today, month, all-time) |
| `/ai reset` | Reset persona to default and clear history |

Chat with Priestess by typing naturally in the configured AI channel — no slash commands needed. She has live access to the homeserver and can call tools, trigger workflows, and remember things across sessions.

**Priestess tools:**
- System stats, Docker containers/logs, Caddy routes
- File system browsing (guarded to `/Users/fu/Server Stuff` and `/Users/fu/Project`)
- Web search (DuckDuckGo)
- Quick notes/todos and persistent key-value memory
- Bookmark management (via n8n)
- n8n workflow triggering with auto-inferred payloads

### Utility

| Command | Description |
|---|---|
| `/ping` | Check bot latency (roundtrip + WebSocket) |

## Monitors

**Container crash alerts** — monitors the Docker event stream and posts an embed to the alerts channel on crash (non-zero exit) or OOM kill. Includes the last 10 log lines.

**System status reporter** — posts system stats (CPU, memory, disk, uptime) to a configured channel every 15 minutes. Optional — disabled if `SYSTEM_CHANNEL_ID` is not set.

**Priestess scheduler** — proactive check-ins on weekdays: morning briefing at 08:00 WIB, evening wrap-up at 17:00 WIB, idle check-in after 3 days of silence.

**Webhook server** — listens for inbound n8n callbacks (default port `3001`). Events tagged `via: priestess` are narrated by Priestess and sent to the AI channel. Other events arrive as embeds to the AI channel.

## n8n Integration

Workflows are registered in the `n8n_workflows` table and triggered via signed webhook `POST`. Priestess reads `workflows/schemas.json` at runtime to inject exact field names into her system prompt, so she can construct correct payloads without asking for clarification.

**Registered workflows (examples):**

| Name | Description |
|---|---|
| Add Calendar Reminder | Creates a Google Calendar event |
| List Calendar Events | Lists upcoming events |
| Delete Calendar Event | Cancels or marks an event done |
| Bookmark Add/Update/Delete | Media bookmark CRUD (called internally by Priestess) |

**Workflow files** are managed as TypeScript using [n8n-as-code](https://www.npmjs.com/package/@n8n-as-code/transformer) and live under `workflows/`. See `AGENTS.md` for the full GitOps protocol.

### Adding a new workflow

1. Register via Discord: `/n8n register name:<name> url:<webhook-url> description:<desc>`
2. Add the payload schema to `workflows/schemas.json` under `workflows["Workflow Name"]`
3. Priestess will pick it up on the next message — no restart needed

If the workflow needs a dedicated Priestess tool (like bookmarks), also:
- Add a `FunctionDeclaration` in `src/clients/priestess/tools/declarations.ts`
- Add a handler function in the appropriate file under `src/clients/priestess/tools/`
- Add a `case` to the dispatcher in `src/clients/priestess/tools/index.ts`

## Project Structure

```
src/
├── index.ts                     # Bot entrypoint, Discord client, event handlers
├── config.ts                    # Env var loading and validation
├── registry.ts                  # Dynamic slash command loader
├── types.ts                     # Shared Command interface
├── clients/
│   ├── priestess/               # Priestess AI — modular
│   │   ├── index.ts             # Barrel re-export (public API unchanged)
│   │   ├── persona.ts           # DEFAULT_PERSONA + getPersona/setPersona
│   │   ├── history.ts           # Chat history DB ops
│   │   ├── chat.ts              # Agentic loop, chat(), notify(), ChatResult
│   │   └── tools/
│   │       ├── declarations.ts  # Gemini FunctionDeclaration array (all 19 tools)
│   │       ├── index.ts         # executeFunction() dispatcher
│   │       ├── system.ts        # System stats, Docker, Caddy tool handlers
│   │       ├── files.ts         # File access (assertAllowed guard)
│   │       ├── search.ts        # Web search via DuckDuckGo
│   │       ├── notes.ts         # Todos + persistent memory + getNotesBlock
│   │       ├── bookmarks.ts     # Bookmark CRUD via n8n
│   │       └── n8n.ts           # trigger_n8n_workflow handler
│   ├── caddy.ts                 # Caddy admin API client
│   ├── db.ts                    # PostgreSQL pool
│   ├── docker.ts                # Dockerode client
│   ├── http.ts                  # Generic HTTP helpers
│   ├── logger.ts                # Discord channel logger
│   ├── n8n-executor.ts          # executeTriggerWorkflow — fire-and-forget webhook POST
│   ├── pob.ts                   # Path of Building client
│   ├── system.ts                # systeminformation wrapper
│   └── webhook-server.ts        # Inbound n8n callback HTTP server (port 3001)
├── commands/
│   ├── ai/                      # /ai command
│   ├── bookmark/                # /bookmark command
│   ├── caddy/                   # /caddy command
│   ├── docker/                  # /docker subcommands (list, start, stop, restart, logs, status, pull, stats)
│   ├── n8n/                     # /n8n command
│   ├── ping/                    # /ping command
│   ├── system/                  # /system command
│   └── worklog/                 # /worklog command
└── monitors/
    ├── container-watcher.ts     # Crash + OOM alerts
    ├── priestess-scheduler.ts   # Morning/evening proactive messages
    └── system-reporter.ts       # Periodic system stats
workflows/
├── schemas.json                 # n8n workflow payload schemas (used by Priestess)
└── 8n8_irfanjauhari_irfan_j/   # n8n-as-code managed workflow TypeScript files
```

## Setup

### Prerequisites

- Node 20+
- Docker + Docker Compose
- A Discord application and bot token ([discord.com/developers](https://discord.com/developers))
- PostgreSQL database
- Google AI Studio API key (Gemini)

### Environment

```bash
cp .env.example .env
# Fill in all values
```

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_GUILD_ID` | Yes | Server ID |
| `DISCORD_CLIENT_ID` | Yes | Application ID |
| `DOCKER_ADMIN_ROLE_ID` | Yes | Role for docker/system/caddy/n8n commands |
| `WORKLOG_ROLE_ID` | Yes | Role for /worklog |
| `ALERTS_CHANNEL_ID` | Yes | Crash alert channel |
| `WORKLOG_API_URL` | Yes | Work log API endpoint |
| `WORKLOG_API_KEY` | Yes | Work log API key |
| `GEMINI_API_KEY` | Yes | Gemini API key |
| `AI_CHANNEL_ID` | Yes | Channel Priestess listens in |
| `AI_USER_ID` | Yes | Your Discord user ID |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `N8N_WEBHOOK_SECRET` | Yes | Shared secret for signing n8n webhook calls |
| `WEBHOOK_PORT` | No | Inbound webhook port (default `3001`) |
| `SYSTEM_CHANNEL_ID` | No | Channel for periodic system stats (disabled if blank) |

### Database

Requires PostgreSQL with these tables:

| Table | Purpose |
|---|---|
| `ai_messages` | Per-user conversation history |
| `ai_persona` | Per-user system prompt overrides |
| `ai_token_usage` | Token usage log |
| `priestess_todos` | Quick notes and todos |
| `priestess_notes` | Persistent key-value memory |
| `n8n_workflows` | Registered webhook workflows |
| `bookmarks` | Media tracking |

### Discord Configuration

1. Create a bot at [discord.com/developers](https://discord.com/developers)
2. Enable `bot` and `applications.commands` scopes
3. Enable **Server Members Intent** and **Message Content Intent** on the Bot page
4. Invite the bot to your server
5. Fill in bot token, application ID, and server ID in `.env`
6. Restrict commands per channel via **Server Settings → Integrations**

### Local Development

```bash
npm install
npm run dev        # ts-node with tsconfig-paths (@/ alias resolved at runtime)
```

### Build & Deploy

```bash
npm run build      # tsc + tsc-alias (rewrites @/ imports in dist/)
npm start          # node dist/index.js
```

Path alias `@/` maps to `src/` — e.g. `import { getPool } from '@/clients/db'`.

#### Docker Compose

```bash
docker compose up -d
```

The compose file mounts the Docker socket (container management) and read-only access to `/Users/fu/Server Stuff` and `/Users/fu/Project` (Priestess file browsing).

#### CI/CD (GitHub Actions + Tailscale)

On every push to `main`, the workflow connects to the homeserver via Tailscale, pulls latest code, writes `.env` from secrets, and rebuilds + restarts the container.

Required GitHub secrets — **org-level:**

| Secret | Description |
|---|---|
| `TAILSCALE_AUTHKEY` | Tailscale auth key (reusable) |
| `SERVER_IP` | Tailscale IP of homeserver |
| `SERVER_USER` | SSH username |
| `SSH_KEY` | SSH private key |
| `PAT_TOKEN` | GitHub Personal Access Token |

Plus all env vars from the table above as repo-level secrets.
