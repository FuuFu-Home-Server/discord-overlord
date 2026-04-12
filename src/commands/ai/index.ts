import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js'
import type { Command } from '../../types'
import { clearHistory, getHistory, setPersona, DEFAULT_PERSONA } from '../../clients/priestess'
import { getPool } from '../../clients/db'
import type { ModalSubmitInteraction } from 'discord.js'

const MODAL_ID = 'ai'

const data = new SlashCommandBuilder()
  .setName('ai')
  .setDescription('Manage Priestess')
  .addSubcommand(sub => sub.setName('clear').setDescription('Clear your conversation history'))
  .addSubcommand(sub => sub.setName('history').setDescription('Show your recent conversation'))
  .addSubcommand(sub => sub.setName('persona').setDescription('Update Priestess system prompt'))
  .addSubcommand(sub => sub.setName('usage').setDescription('Show your Priestess token usage stats'))
  .addSubcommand(sub => sub.setName('reset').setDescription('Reset persona to default and clear conversation history'))

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand()

  if (sub === 'clear') {
    await clearHistory(interaction.user.id)
    await interaction.reply({ content: 'Conversation history cleared. Priestess starts fresh.', ephemeral: true })
    return
  }

  if (sub === 'reset') {
    const db = getPool()
    await Promise.all([
      clearHistory(interaction.user.id),
      db.query('DELETE FROM ai_persona WHERE user_id = $1', [interaction.user.id]),
    ])
    await interaction.reply({ content: 'Persona reset to default and conversation history cleared.', ephemeral: true })
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

  if (sub === 'usage') {
    await interaction.deferReply({ ephemeral: true })
    const db = getPool()
    const result = await db.query(`
      SELECT
        COUNT(*)::int AS calls,
        COALESCE(SUM(prompt_tokens), 0)::int AS prompt_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
        COALESCE(SUM(total_tokens), 0)::int AS total_tokens,
        COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= date_trunc('day', NOW())), 0)::int AS today_tokens,
        COALESCE(SUM(total_tokens) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0)::int AS month_tokens
      FROM ai_token_usage
      WHERE user_id = $1
    `, [interaction.user.id])
    const row = result.rows[0]
    const embed = new EmbedBuilder()
      .setTitle('Priestess Token Usage')
      .setColor(0x9b59b6)
      .addFields(
        { name: 'Today', value: `${row.today_tokens.toLocaleString()} tokens`, inline: true },
        { name: 'This Month', value: `${row.month_tokens.toLocaleString()} tokens`, inline: true },
        { name: 'All Time', value: `${row.total_tokens.toLocaleString()} tokens`, inline: true },
        { name: 'Total Calls', value: `${row.calls.toLocaleString()}`, inline: true },
        { name: 'Input / Output', value: `${row.prompt_tokens.toLocaleString()} / ${row.output_tokens.toLocaleString()}`, inline: true },
      )
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
