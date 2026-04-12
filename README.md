# discord-overlord

A Discord bot that acts as a control plane for a personal homeserver. Manages Docker containers, monitors system stats, logs work entries, inspects reverse proxy routes, and hosts Priestess — a persistent AI personal assistant powered by Gemini.

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
| `/log` | Open a modal to log a work task to your dashboard API |

Modal fields: summary (required), duration (required, e.g. `1h30m`), start date (pre-filled to today 09:00), description (optional multiline).

Requires the worklog role.

### Priestess AI

| Command | Description |
|---|---|
| `/ai clear` | Wipe conversation history (keeps persona) |
| `/ai history` | Show your last 10 messages with Priestess |
| `/ai persona` | Update Priestess's system prompt |

Chat with Priestess by typing naturally in the configured AI channel — no slash commands needed.

### Utility

| Command | Description |
|---|---|
| `/ping` | Check bot latency (roundtrip + WebSocket) |

## Monitors

**Container crash alerts** — monitors the Docker event stream and posts an embed to the alerts channel on crash (non-zero exit) or OOM kill. Includes the last 10 log lines.

**System status reporter** — posts system stats (CPU, memory, disk, uptime) to a configured channel every 15 minutes. Optional.

**Priestess scheduler** — proactive check-ins on weekdays: morning briefing at 08:00 WIB, evening wrap-up at 17:00 WIB, idle check-in after 3 days of silence.

## Setup

### Prerequisites

- Node 20+
- Docker + Docker Compose
- A Discord application and bot token ([discord.com/developers](https://discord.com/developers))
- PostgreSQL database (for Priestess)
- Google AI Studio API key (for Priestess)

### Local Development

```bash
cp .env.example .env
# Fill in all values in .env
npm install
npm run dev
```

### Discord Configuration

1. Create a bot at [discord.com/developers](https://discord.com/developers)
2. Enable `bot` and `applications.commands` scopes
3. Enable **Server Members Intent** and **Message Content Intent** on the Bot page
4. Invite the bot to your server
5. Copy bot token, application ID, and server ID into `.env`
6. Restrict commands to specific channels via **Server Settings → Integrations → Overlord**

### Deployment (Docker Compose + GitHub Actions + Tailscale)

On every push to `main`, the workflow:
1. Connects to your homeserver via Tailscale
2. SSHes in, pulls latest code, writes `.env` from secrets, rebuilds and restarts the container

Required GitHub secrets:

**Org-level (reusable):**

| Secret | Description |
|---|---|
| `TAILSCALE_AUTHKEY` | Tailscale auth key (reusable) |
| `SERVER_IP` | Tailscale IP of your homeserver |
| `SERVER_USER` | SSH username |
| `SSH_KEY` | SSH private key |
| `PAT_TOKEN` | GitHub Personal Access Token |

**Repo-level:**

| Secret | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_GUILD_ID` | Server ID |
| `DISCORD_CLIENT_ID` | Application ID |
| `DOCKER_ADMIN_ROLE_ID` | Role for docker/system/caddy commands |
| `WORKLOG_ROLE_ID` | Role for /log command |
| `ALERTS_CHANNEL_ID` | Channel for crash alerts |
| `WORKLOG_API_URL` | Work log API endpoint |
| `WORKLOG_API_KEY` | Work log API key |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `AI_CHANNEL_ID` | Channel where Priestess listens |
| `AI_USER_ID` | Your Discord user ID |
| `DATABASE_URL` | PostgreSQL connection string |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_GUILD_ID` | Yes | Your server ID |
| `DISCORD_CLIENT_ID` | Yes | Application ID |
| `DOCKER_ADMIN_ROLE_ID` | Yes | Role for docker/system/caddy commands |
| `WORKLOG_ROLE_ID` | Yes | Role for /log |
| `ALERTS_CHANNEL_ID` | Yes | Crash alert channel |
| `WORKLOG_API_URL` | Yes | Work log API endpoint |
| `WORKLOG_API_KEY` | Yes | Work log API key |
| `GEMINI_API_KEY` | Yes | Gemini API key |
| `AI_CHANNEL_ID` | Yes | Priestess chat channel |
| `AI_USER_ID` | Yes | Your Discord user ID |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SYSTEM_CHANNEL_ID` | No | Channel for periodic system status posts |

## Adding New Integrations

1. Create `src/commands/<service>/index.ts` exporting a `Command` as default
2. Add any needed client in `src/clients/`
3. Add required env vars to `.env.example` and `config.ts`
4. Import and wire up the command in `src/index.ts`
