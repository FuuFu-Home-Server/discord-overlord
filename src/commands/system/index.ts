import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import type { Command } from '../../types'
import { getSystemStats } from '../../clients/system'

let adminRoleId = ''
export function setAdminRoleId(id: string): void { adminRoleId = id }

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

const data = new SlashCommandBuilder()
  .setName('system')
  .setDescription('Show host system stats')

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  await interaction.deferReply()
  try {
    const stats = await getSystemStats()
    const embed = new EmbedBuilder()
      .setTitle('System Stats')
      .addFields(
        { name: 'CPU Load', value: `${stats.cpuLoad.toFixed(1)}%`, inline: true },
        { name: 'Memory', value: `${formatBytes(stats.memUsedBytes)} / ${formatBytes(stats.memTotalBytes)}`, inline: true },
        { name: 'Disk (/)', value: `${formatBytes(stats.diskUsedBytes)} / ${formatBytes(stats.diskTotalBytes)}`, inline: true },
        { name: 'Uptime', value: formatUptime(stats.uptimeSeconds), inline: true },
      )
      .setColor(0x2b2d31)
      .setTimestamp()
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}

const command: Command = { data, execute }
export default command
