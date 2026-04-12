import { Client, EmbedBuilder } from 'discord.js'
import { getSystemStats } from '../clients/system'

const INTERVAL_MS = 15 * 60 * 1000

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

async function postSystemStatus(client: Client, channelId: string): Promise<void> {
  const channel = client.channels.cache.get(channelId)
  if (!channel?.isSendable()) return

  try {
    const stats = await getSystemStats()
    const embed = new EmbedBuilder()
      .setTitle('System Status')
      .addFields(
        { name: 'CPU Load', value: `${stats.cpuLoad.toFixed(1)}%`, inline: true },
        { name: 'Memory', value: `${formatBytes(stats.memUsedBytes)} / ${formatBytes(stats.memTotalBytes)}`, inline: true },
        { name: 'Disk (/)', value: `${formatBytes(stats.diskUsedBytes)} / ${formatBytes(stats.diskTotalBytes)}`, inline: true },
        { name: 'Uptime', value: formatUptime(stats.uptimeSeconds), inline: true },
      )
      .setColor(0x2b2d31)
      .setTimestamp()

    await channel.send({ embeds: [embed] })
  } catch (err) {
    console.error('Failed to post system status:', err)
  }
}

export function startSystemReporter(client: Client, channelId: string): void {
  void postSystemStatus(client, channelId)
  setInterval(() => void postSystemStatus(client, channelId), INTERVAL_MS)
}
