import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { getContainerStats } from '../../clients/docker'

export async function handleStats(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  const name = interaction.options.getString('container', true)
  await interaction.deferReply()
  try {
    const stats = await getContainerStats(name)
    const embed = new EmbedBuilder()
      .setTitle(`Stats — ${name}`)
      .addFields(
        { name: 'CPU', value: stats.cpu, inline: true },
        { name: 'Memory', value: stats.memory, inline: true },
      )
      .setColor(0x2b2d31)
      .setTimestamp()
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}
