import { Client, EmbedBuilder } from 'discord.js'
import { streamEvents } from '../clients/docker'

export function startContainerWatcher(client: Client, alertsChannelId: string): void {
  streamEvents((event) => {
    if (event.Type !== 'container') return
    if (event.Action !== 'die' && event.Action !== 'oom') return

    const channel = client.channels.cache.get(alertsChannelId)
    if (!channel?.isSendable()) return

    const containerName = event.Actor?.Attributes?.name ?? event.id
    const exitCode = event.Actor?.Attributes?.exitCode ?? 'unknown'
    const isOom = event.Action === 'oom'

    const embed = new EmbedBuilder()
      .setTitle(isOom ? 'Container OOM Killed' : 'Container Crashed')
      .setDescription(`**${containerName}** exited with code \`${exitCode}\``)
      .setColor(isOom ? 0xff6b35 : 0xed4245)
      .setTimestamp(new Date(event.time * 1000))

    channel.send({ embeds: [embed] }).catch((err: Error) => console.error('Failed to send alert:', err))
  })
}
