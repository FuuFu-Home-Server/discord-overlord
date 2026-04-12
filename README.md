# discord-overlord

A Discord bot that acts as a control plane for a personal homeserver. Manages Docker containers, reports system stats, and logs work entries — all via slash commands.

## Commands

### Docker Management

All Docker commands require the Docker admin role.

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

### Work Log

| Command | Description |
|---|---|
| `/log <work> <date> <time_spent>` | Log a work entry to your website API |

Example: `/log discord-overlord 2026-04-12 3h30m`

Requires the worklog role.

## Crash Alerts

The bot monitors the Docker event stream and posts an alert embed to the configured alerts channel whenever a container crashes (non-zero exit) or is OOM killed.

## Setup

### Prerequisites

- Node 20+
- Docker + Docker Compose
- A Discord application and bot token ([discord.com/developers](https://discord.com/developers))

### Local Development

```bash
cp .env.example .env
# Fill in all values in .env
npm install
npm run dev
```

### Discord Configuration

1. Create a bot at [discord.com/developers](https://discord.com/developers)
2. Enable the `bot` and `applications.commands` scopes
3. Invite the bot to your server with those scopes
4. Copy the bot token, application ID, and your server ID into `.env`

### Deployment (Docker Compose)

On your homeserver, create `~/discord-overlord/docker-compose.yml` (copy from repo) and `~/discord-overlord/.env` (fill in values):

```bash
docker compose pull
docker compose up -d
```

### CI/CD (GitHub Actions + Tailscale)

On every push to `main`, the workflow:
1. Builds a multi-arch image (amd64 + arm64) and pushes to GHCR
2. Connects to your Tailscale network
3. SSHes into your homeserver to pull and restart the container

Required GitHub secrets:

| Secret | Description |
|---|---|
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID |
| `TS_OAUTH_CLIENT_SECRET` | Tailscale OAuth client secret |
| `HOMESERVER_TAILSCALE_IP` | Tailscale IP of your homeserver |
| `HOMESERVER_SSH_USER` | SSH username on the homeserver |
| `HOMESERVER_SSH_KEY` | Private SSH key for the deploy user |

## Adding New Integrations

1. Create `src/commands/<service>/index.ts` exporting a `Command` as default
2. Add any needed client in `src/clients/`
3. Add required env vars to `.env.example` and `config.ts`
4. Import and wire up the command in `src/index.ts`

## Environment Variables

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_GUILD_ID` | Your server ID |
| `DISCORD_CLIENT_ID` | Application ID |
| `DOCKER_ADMIN_ROLE_ID` | Role required for docker/system commands |
| `WORKLOG_ROLE_ID` | Role required for /log command |
| `ALERTS_CHANNEL_ID` | Channel for crash alert notifications |
| `WORKLOG_API_URL` | Website API endpoint for work log entries |
| `WORKLOG_API_KEY` | API key for the work log endpoint |
