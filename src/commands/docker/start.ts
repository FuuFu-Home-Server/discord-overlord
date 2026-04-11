import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { startContainer } from '../../clients/docker'

export async function handleStart(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  const name = interaction.options.getString('container', true)
  await interaction.deferReply()
  try {
    await startContainer(name)
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('Container Started').setDescription(`**${name}** is now starting.`).setColor(0x57f287).setTimestamp()],
    })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}
