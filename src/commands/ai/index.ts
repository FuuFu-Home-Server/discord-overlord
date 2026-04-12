import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js'
import type { Command } from '../../types'
import { clearHistory, getHistory, setPersona, DEFAULT_PERSONA } from '../../clients/priestess'
import type { ModalSubmitInteraction } from 'discord.js'

const MODAL_ID = 'ai'

const data = new SlashCommandBuilder()
  .setName('ai')
  .setDescription('Manage Priestess')
  .addSubcommand(sub => sub.setName('clear').setDescription('Clear your conversation history'))
  .addSubcommand(sub => sub.setName('history').setDescription('Show your recent conversation'))
  .addSubcommand(sub => sub.setName('persona').setDescription('Update Priestess system prompt'))

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand()

  if (sub === 'clear') {
    await clearHistory(interaction.user.id)
    await interaction.reply({ content: 'Conversation history cleared. Priestess starts fresh.', ephemeral: true })
    return
  }

  if (sub === 'history') {
    await interaction.deferReply({ ephemeral: true })
    const history = await getHistory(interaction.user.id)
    if (history.length === 0) {
      await interaction.editReply('No conversation history yet.')
      return
    }
    const lines = history.slice(-10).map(({ role, content }) => {
      const label = role === 'user' ? '**You:**' : '**Priestess:**'
      const truncated = content.length > 200 ? `${content.slice(0, 200)}…` : content
      return `${label} ${truncated}`
    })
    const embed = new EmbedBuilder()
      .setTitle('Recent Conversation')
      .setDescription(lines.join('\n\n'))
      .setColor(0x9b59b6)
    await interaction.editReply({ embeds: [embed] })
    return
  }

  if (sub === 'persona') {
    const modal = new ModalBuilder()
      .setCustomId(MODAL_ID)
      .setTitle('Update Priestess Persona')

    const input = new TextInputBuilder()
      .setCustomId('prompt')
      .setLabel('System prompt')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Describe who Priestess is and what she knows about you...')
      .setValue(DEFAULT_PERSONA)
      .setRequired(true)
      .setMaxLength(4000)

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
    await interaction.showModal(modal)
  }
}

async function modalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const prompt = interaction.fields.getTextInputValue('prompt')
  await setPersona(interaction.user.id, prompt)
  await interaction.reply({ content: 'Priestess persona updated.', ephemeral: true })
}

const command: Command = { data, execute, modalSubmit }
export default command
