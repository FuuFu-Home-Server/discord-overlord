import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { listContainers } from '../../clients/docker'

export async function handleList(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  await interaction.deferReply()
  const containers = await listContainers()
  const lines = containers.map(c => {
    const emoji = c.state === 'running' ? '🟢' : '🔴'
    return `${emoji} **${c.name}** — ${c.status}`
  })
  const embed = new EmbedBuilder()
    .setTitle('Docker Containers')
    .setDescription(lines.join('\n') || 'No containers found.')
    .setColor(0x2b2d31)
    .setTimestamp()
  await interaction.editReply({ embeds: [embed] })
}
