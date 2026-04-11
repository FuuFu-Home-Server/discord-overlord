import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { stopContainer } from '../../clients/docker'

export async function handleStop(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  const name = interaction.options.getString('container', true)
  await interaction.deferReply()
  try {
    await stopContainer(name)
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('Container Stopped').setDescription(`**${name}** has been stopped.`).setColor(0xed4245).setTimestamp()],
    })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}
