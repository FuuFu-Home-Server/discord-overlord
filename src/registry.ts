import { REST, Routes } from 'discord.js'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { Command } from './types'
import type { Config } from './config'

export async function loadCommands(commandsDir: string): Promise<Command[]> {
  const commands: Command[] = []

  let entries: string[]
  try {
    entries = readdirSync(commandsDir)
  } catch {
    return commands
  }

  for (const entry of entries) {
    const entryPath = join(commandsDir, entry)
    try {
      if (!statSync(entryPath).isDirectory()) continue
    } catch {
      continue
    }

    const indexPath = join(entryPath, 'index')
    try {
      const mod = await import(indexPath) as { default?: Command }
      if (mod.default) commands.push(mod.default)
    } catch {
      // skip directories without a valid index
    }
  }

  return commands
}

export async function registerCommands(config: Config, commands: Command[]): Promise<void> {
  const rest = new REST().setToken(config.discord.token)
  const body = commands.map(c => c.data.toJSON())

  await rest.put(
    Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
    { body }
  )

  console.log(`Registered ${commands.length} slash commands.`)
}
