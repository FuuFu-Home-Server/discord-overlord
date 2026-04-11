import { loadConfig } from '../src/config'

const REQUIRED_VARS = [
  'DISCORD_TOKEN',
  'DISCORD_GUILD_ID',
  'DISCORD_CLIENT_ID',
  'DOCKER_ADMIN_ROLE_ID',
  'WORKLOG_ROLE_ID',
  'ALERTS_CHANNEL_ID',
  'WORKLOG_API_URL',
  'WORKLOG_API_KEY',
]

const FULL_ENV: Record<string, string> = {
  DISCORD_TOKEN: 'tok',
  DISCORD_GUILD_ID: 'guild',
  DISCORD_CLIENT_ID: 'client',
  DOCKER_ADMIN_ROLE_ID: 'adminrole',
  WORKLOG_ROLE_ID: 'workrole',
  ALERTS_CHANNEL_ID: 'alertchan',
  WORKLOG_API_URL: 'https://example.com/api',
  WORKLOG_API_KEY: 'secret',
}

describe('loadConfig', () => {
  let savedEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    savedEnv = { ...process.env }
    Object.assign(process.env, FULL_ENV)
  })

  afterEach(() => {
    for (const key of REQUIRED_VARS) delete process.env[key]
    Object.assign(process.env, savedEnv)
  })

  it('returns a valid config when all env vars are set', () => {
    const config = loadConfig()
    expect(config.discord.token).toBe('tok')
    expect(config.discord.guildId).toBe('guild')
    expect(config.discord.clientId).toBe('client')
    expect(config.roles.dockerAdminRoleId).toBe('adminrole')
    expect(config.roles.worklogRoleId).toBe('workrole')
    expect(config.alertsChannelId).toBe('alertchan')
    expect(config.worklog.apiUrl).toBe('https://example.com/api')
    expect(config.worklog.apiKey).toBe('secret')
  })

  for (const key of REQUIRED_VARS) {
    it(`throws when ${key} is missing`, () => {
      delete process.env[key]
      expect(() => loadConfig()).toThrow(`Missing required env var: ${key}`)
    })
  }
})
