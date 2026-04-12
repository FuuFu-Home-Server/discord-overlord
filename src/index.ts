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

function splitMessage(text: string, limit = 2000): string[] {
  if (text.length <= limit) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining)
      break
    }
    let cut = remaining.lastIndexOf('\n', limit)
    if (cut <= 0) cut = limit
    chunks.push(remaining.slice(0, cut))
    remaining = remaining.slice(cut).trimStart()
  }
  return chunks
}

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
    logStartup(c.user.tag).catch(console.error)
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
      const result = await chat(message.author.id, message.content)
      const chunks = splitMessage(result.reply)
      await message.reply(chunks[0])
      for (let i = 1; i < chunks.length; i++) {
        await message.channel.send(chunks[i])
      }
      await logPriestessCall(message.author.id, message.content, result, Date.now() - start)
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
