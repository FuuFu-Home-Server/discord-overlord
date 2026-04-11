import { ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import { getContainerLogs } from '../../clients/docker'

export async function handleLogs(interaction: ChatInputCommandInteraction, adminRoleId: string): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(adminRoleId)) {
    await interaction.reply({ content: 'You need the Docker admin role to use this command.', ephemeral: true })
    return
  }
  const name = interaction.options.getString('container', true)
  const lines = interaction.options.getInteger('lines') ?? 50
  await interaction.deferReply()
  try {
    const logs = await getContainerLogs(name, lines)
    const truncated = logs.length > 1900 ? `...${logs.slice(-1900)}` : logs
    const embed = new EmbedBuilder()
      .setTitle(`Logs — ${name} (last ${lines} lines)`)
      .setDescription(`\`\`\`\n${truncated}\n\`\`\``)
      .setColor(0x2b2d31)
      .setTimestamp()
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    await interaction.editReply(`Error: ${(err as Error).message}`)
  }
}
