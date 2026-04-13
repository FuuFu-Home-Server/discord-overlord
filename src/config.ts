export interface Config {
  discord: {
    token: string
    guildId: string
    clientId: string
  }
  roles: {
    dockerAdminRoleId: string
    worklogRoleId: string
  }
  alertsChannelId: string
  systemChannelId: string | null
  aiChannelId: string | null
  aiUserId: string | null
  worklog: {
    apiUrl: string
    apiKey: string
  }
  webhookPort: number
  n8nWebhookSecret: string
}

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

export function loadConfig(): Config {
  return {
    discord: {
      token: requireEnv('DISCORD_TOKEN'),
      guildId: requireEnv('DISCORD_GUILD_ID'),
      clientId: requireEnv('DISCORD_CLIENT_ID'),
    },
    roles: {
      dockerAdminRoleId: requireEnv('DOCKER_ADMIN_ROLE_ID'),
      worklogRoleId: requireEnv('WORKLOG_ROLE_ID'),
    },
    alertsChannelId: requireEnv('ALERTS_CHANNEL_ID'),
    systemChannelId: process.env.SYSTEM_CHANNEL_ID ?? null,
    aiChannelId: process.env.AI_CHANNEL_ID ?? null,
    aiUserId: process.env.AI_USER_ID ?? null,
    worklog: {
      apiUrl: requireEnv('WORKLOG_API_URL'),
      apiKey: requireEnv('WORKLOG_API_KEY'),
    },
    webhookPort: parseInt(process.env.WEBHOOK_PORT ?? '3001', 10),
    n8nWebhookSecret: requireEnv('N8N_WEBHOOK_SECRET'),
  }
}
