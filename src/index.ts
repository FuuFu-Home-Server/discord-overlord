import { Client, GatewayIntentBits, Events, Collection } from 'discord.js'
import path from 'path'
import { loadConfig } from './config'
import { loadCommands, registerCommands } from './registry'
import { startContainerWatcher } from './monitors/container-watcher'
import { startSystemReporter } from './monitors/system-reporter'
import { startPriestessScheduler } from './monitors/priestess-scheduler'
import { initDb } from './clients/db'
import { chat } from './clients/priestess'
import { initLogger, logStartup, logPriestessCall, logPriestessError } from './clients/logger'
import type { Command } from './types'

// Direct imports to inject config into each command module before registry loads them
import dockerCommand, { setAdminRoleId as setDockerAdminRoleId } from './commands/docker/index'
import systemCommand, { setAdminRoleId as setSystemAdminRoleId } from './commands/system/index'
import worklogCommand from './commands/worklog/index'
import caddyCommand, { setAdminRoleId as setCaddyAdminRoleId } from './commands/caddy/index'

async function main(): Promise<void> {
  const config = loadConfig()
  await initDb()

  setDockerAdminRoleId(config.roles.dockerAdminRoleId)
  setSystemAdminRoleId(config.roles.dockerAdminRoleId)
  setCaddyAdminRoleId(config.roles.dockerAdminRoleId)
  worklogCommand.setWorklogConfig(config.worklog.apiUrl, config.worklog.apiKey, config.roles.worklogRoleId)

  // Suppress unused-variable warnings — imports are side-effectful (module cache priming)
  void dockerCommand
  void systemCommand
  void caddyCommand

  const commands = new Collection<string, Command>()
  const loaded = await loadCommands(path.join(__dirname, 'commands'))
  for (const cmd of loaded) {
    commands.set(cmd.data.name, cmd)
  }

  await registerCommands(config, loaded)

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

  client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`)
    initLogger(client)
    await logStartup(c.user.tag)
    startContainerWatcher(client, config.alertsChannelId)
    if (config.systemChannelId) {
      startSystemReporter(client, config.systemChannelId)
    }
    if (config.aiChannelId && config.aiUserId) {
      startPriestessScheduler(client, config.aiChannelId, config.aiUserId)
    }
  })

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return
    if (!config.aiChannelId || message.channelId !== config.aiChannelId) return
    if (message.guildId !== config.discord.guildId) return

    try {
      await message.channel.sendTyping()
      const start = Date.now()
      const reply = await chat(message.author.id, message.content)
      await message.reply(reply)
      await logPriestessCall(message.author.id, message.content, reply, Date.now() - start)
    } catch (err) {
      console.error('Priestess chat error:', err)
      await logPriestessError(message.author.id, message.content, err)
    }
  })

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.guildId !== config.discord.guildId) return

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

    if (interaction.isModalSubmit()) {
      const commandName = interaction.customId.split(':')[0]
      const command = commands.get(commandName)
      if (command?.modalSubmit) {
        try {
          await command.modalSubmit(interaction)
        } catch (err) {
          console.error('Modal submit error:', err)
          const payload = { content: 'An unexpected error occurred.', ephemeral: true }
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload)
          } else {
            await interaction.reply(payload)
          }
        }
      }
      return
    }

    if (!interaction.isChatInputCommand()) return

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
