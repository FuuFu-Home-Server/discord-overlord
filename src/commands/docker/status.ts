import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { getContainerStatus } from '../../clients/docker'

export async function handleStatus(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  const name = interaction.options.getString('container', true)
  await interaction.deferReply()
  try {
    const info = await getContainerStatus(name)
    const embed = new EmbedBuilder()
      .setTitle(`Status — ${info.Name.replace(/^\//, '')}`)
      .addFields(
        { name: 'State', value: info.State.Status, inline: true },
        { name: 'Image', value: info.Config.Image, inline: true },
        { name: 'Restarts', value: String(info.RestartCount ?? 0), inline: true },
        { name: 'Started', value: new Date(info.State.StartedAt).toUTCString(), inline: false },
      )
      .setColor(info.State.Status === 'running' ? 0x57f287 : 0xed4245)
      .setTimestamp()
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}
