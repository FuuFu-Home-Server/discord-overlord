import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandStringOption,
} from 'discord.js'
import type { Command } from '../../types'
import { listContainers } from '../../clients/docker'
import { handleList } from './list'
import { handleStart } from './start'
import { handleStop } from './stop'
import { handleRestart } from './restart'
import { handleLogs } from './logs'
import { handleStatus } from './status'
import { handlePull } from './pull'
import { handleStats } from './stats'

let adminRoleId = ''
export function setAdminRoleId(id: string): void { adminRoleId = id }

const containerOption = (desc: string) => (opt: SlashCommandStringOption) =>
  opt.setName('container').setDescription(desc).setRequired(true).setAutocomplete(true)

const data = new SlashCommandBuilder()
  .setName('docker')
  .setDescription('Manage Docker containers')
  .addSubcommand(sub => sub.setName('list').setDescription('List all containers'))
  .addSubcommand(sub => sub.setName('start').setDescription('Start a container')
    .addStringOption(containerOption('Container name')))
  .addSubcommand(sub => sub.setName('stop').setDescription('Stop a container')
    .addStringOption(containerOption('Container name')))
  .addSubcommand(sub => sub.setName('restart').setDescription('Restart a container')
    .addStringOption(containerOption('Container name')))
  .addSubcommand(sub => sub.setName('logs').setDescription('Fetch container logs')
    .addStringOption(containerOption('Container name'))
    .addIntegerOption(opt => opt.setName('lines').setDescription('Number of log lines (default 50)').setMinValue(1).setMaxValue(500)))
  .addSubcommand(sub => sub.setName('status').setDescription('Show container status')
    .addStringOption(containerOption('Container name')))
  .addSubcommand(sub => sub.setName('pull').setDescription('Pull latest image')
    .addStringOption(containerOption('Container name')))
  .addSubcommand(sub => sub.setName('stats').setDescription('Show CPU and memory usage')
    .addStringOption(containerOption('Container name')))

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand()
  switch (sub) {
    case 'list': return handleList(interaction, adminRoleId)
    case 'start': return handleStart(interaction, adminRoleId)
    case 'stop': return handleStop(interaction, adminRoleId)
    case 'restart': return handleRestart(interaction, adminRoleId)
    case 'logs': return handleLogs(interaction, adminRoleId)
    case 'status': return handleStatus(interaction, adminRoleId)
    case 'pull': return handlePull(interaction, adminRoleId)
    case 'stats': return handleStats(interaction, adminRoleId)
  }
}

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focused = interaction.options.getFocused()
    const containers = await listContainers()
    const choices = containers
      .filter(c => c.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map(c => ({ name: c.name, value: c.name }))
    await interaction.respond(choices)
  } catch {
    await interaction.respond([])
  }
}

const command: Command = { data, execute, autocomplete }
export default command
