import { Client, GatewayIntentBits, Events, Collection } from 'discord.js'
import path from 'path'
import { loadConfig } from './config'
import { loadCommands, registerCommands } from './registry'
import { startContainerWatcher } from './monitors/container-watcher'
import type { Command } from './types'

// Direct imports to inject config into each command module before registry loads them
import dockerCommand, { setAdminRoleId as setDockerAdminRoleId } from './commands/docker/index'
import systemCommand, { setAdminRoleId as setSystemAdminRoleId } from './commands/system/index'
import worklogCommand from './commands/worklog/index'

async function main(): Promise<void> {
  const config = loadConfig()

  setDockerAdminRoleId(config.roles.dockerAdminRoleId)
  setSystemAdminRoleId(config.roles.dockerAdminRoleId)
  worklogCommand.setWorklogConfig(config.worklog.apiUrl, config.worklog.apiKey, config.roles.worklogRoleId)

  // Suppress unused-variable warnings — imports are side-effectful (module cache priming)
  void dockerCommand
  void systemCommand

  const commands = new Collection<string, Command>()
  const loaded = await loadCommands(path.join(__dirname, 'commands'))
  for (const cmd of loaded) {
    commands.set(cmd.data.name, cmd)
  }

  await registerCommands(config, loaded)

  const client = new Client({ intents: [GatewayIntentBits.Guilds] })

  client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`)
    startContainerWatcher(client, config.alertsChannelId)
  })

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName)
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction)
        } catch (err) {
          console.error('Autocomplete error:', err)
          await interaction.respond([])
        }
      }
      return
    }

    if (!interaction.isChatInputCommand()) return
    if (interaction.guildId !== config.discord.guildId) return

    const command = commands.get(interaction.commandName)
    if (!command) return

    try {
      await command.execute(interaction)
    } catch (err) {
      console.error('Command error:', err)
      const payload = { content: 'An unexpected error occurred.', ephemeral: true }
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload)
      } else {
        await interaction.reply(payload)
      }
    }
  })

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down.')
    client.destroy()
    process.exit(0)
  })

  await client.login(config.discord.token)
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
