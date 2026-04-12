import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import type { Command } from '../../types'
import { getCaddyRoutes, pingUpstream } from '../../clients/caddy'

let adminRoleId = ''
export function setAdminRoleId(id: string): void { adminRoleId = id }

const data = new SlashCommandBuilder()
  .setName('caddy')
  .setDescription('List reverse proxy routes and their status')

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }

  await interaction.deferReply()

  try {
    const routes = await getCaddyRoutes()

    if (routes.length === 0) {
      await interaction.editReply('No reverse proxy routes found.')
      return
    }

    const results = await Promise.all(
      routes.map(async (route) => {
        const pings = await Promise.all(route.upstreams.map(pingUpstream))
        return { route, pings }
      })
    )

    const lines = results.map(({ route, pings }) => {
      const hosts = route.hosts.join(', ') || '(no host)'
      const upstreamLines = route.upstreams.map((u, i) => {
        const { ok, ms } = pings[i]
        return `  ${ok ? '🟢' : '🔴'} \`${u}\` ${ok ? `${ms}ms` : 'unreachable'}`
      })
      return `**${hosts}**\n${upstreamLines.join('\n')}`
    })

    const chunkSize = 10
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n\n')
      const embed = new EmbedBuilder()
        .setTitle(i === 0 ? 'Caddy Reverse Proxy' : 'Caddy Reverse Proxy (cont.)')
        .setDescription(chunk)
        .setColor(0x2b2d31)
        .setTimestamp()

      if (i === 0) {
        await interaction.editReply({ embeds: [embed] })
      } else {
        await interaction.followUp({ embeds: [embed] })
      }
    }
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}

const command: Command = { data, execute }
export default command
