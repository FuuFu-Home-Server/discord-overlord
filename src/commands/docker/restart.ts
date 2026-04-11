import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { restartContainer } from '../../clients/docker'

export async function handleRestart(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  const name = interaction.options.getString('container', true)
  await interaction.deferReply()
  try {
    await restartContainer(name)
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('Container Restarted').setDescription(`**${name}** has been restarted.`).setColor(0xfee75c).setTimestamp()],
    })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}
