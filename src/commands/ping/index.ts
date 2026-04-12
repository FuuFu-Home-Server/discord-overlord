import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import type { Command } from '../../types'

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check if the bot is alive')

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true })
  const latency = sent.createdTimestamp - interaction.createdTimestamp
  const wsLatency = interaction.client.ws.ping

  const embed = new EmbedBuilder()
    .setTitle('Pong!')
    .addFields(
      { name: 'Roundtrip', value: `${latency}ms`, inline: true },
      { name: 'WebSocket', value: `${wsLatency}ms`, inline: true },
    )
    .setColor(0x57f287)
    .setTimestamp()

  await interaction.editReply({ content: '', embeds: [embed] })
}

const command: Command = { data, execute }
export default command
