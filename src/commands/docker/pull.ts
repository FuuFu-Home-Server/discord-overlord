import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { getContainerImage, pullContainerImage } from '../../clients/docker'

export async function handlePull(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  const name = interaction.options.getString('container', true)
  await interaction.deferReply()
  try {
    const imageName = await getContainerImage(name)
    await pullContainerImage(imageName)
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('Image Pulled')
        .setDescription(`Pulled latest \`${imageName}\` for **${name}**.\nRestart the container to apply the update.`)
        .setColor(0x57f287)
        .setTimestamp()],
    })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}
