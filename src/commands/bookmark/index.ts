import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js'
import type { Command } from '../../types'
import { executeTriggerWorkflow } from '../../clients/n8n-executor'

const MODAL_ID = 'bookmark'

const VALID_TYPES = ['manhwa', 'manga', 'manhua', 'anime', 'novel']
const VALID_STATUSES = ['reading', 'watching', 'completed', 'dropped', 'on_hold', 'plan_to_start']

const data = new SlashCommandBuilder()
  .setName('bookmark')
  .setDescription('Manage your media bookmarks')
  .addSubcommand(sub =>
    sub.setName('add').setDescription('Add a new bookmark (opens form)')
  )
  .addSubcommand(sub =>
    sub.setName('update')
      .setDescription('Update an existing bookmark')
      .addStringOption(opt => opt.setName('name').setDescription('Bookmark name').setRequired(true))
      .addStringOption(opt => opt.setName('progress').setDescription('e.g. Ch. 142 / Ep. 12').setRequired(false))
      .addStringOption(opt => opt.setName('status').setDescription('reading/watching/completed/dropped/on_hold/plan_to_start').setRequired(false))
      .addStringOption(opt => opt.setName('notes').setDescription('Notes or review').setRequired(false))
  )
  .addSubcommand(sub =>
    sub.setName('delete')
      .setDescription('Delete a bookmark')
      .addStringOption(opt => opt.setName('name').setDescription('Bookmark name').setRequired(true))
  )

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand()

  if (sub === 'add') {
    const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('Add Bookmark')
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('name').setLabel('Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('type').setLabel('Type').setStyle(TextInputStyle.Short).setPlaceholder('manhwa / manga / manhua / anime / novel').setRequired(true).setMaxLength(20)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('status').setLabel('Status').setStyle(TextInputStyle.Short).setPlaceholder('reading / watching / completed / dropped / on_hold / plan_to_start').setRequired(true).setMaxLength(20)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('progress').setLabel('Progress (optional)').setStyle(TextInputStyle.Short).setPlaceholder('Ch. 1 / Ep. 1').setRequired(false).setMaxLength(50)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('notes').setLabel('Notes (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
      ),
    )
    await interaction.showModal(modal)
    return
  }

  if (sub === 'update') {
    await interaction.deferReply({ ephemeral: true })
    const name = interaction.options.getString('name', true)
    const progress = interaction.options.getString('progress') ?? undefined
    const status = interaction.options.getString('status') ?? undefined
    const notes = interaction.options.getString('notes') ?? undefined

    if (status && !VALID_STATUSES.includes(status)) {
      await interaction.editReply(`Invalid status. Use one of: ${VALID_STATUSES.join(', ')}`)
      return
    }
    if (!progress && !status && !notes) {
      await interaction.editReply('Provide at least one field to update: progress, status, or notes.')
      return
    }

    const result = await executeTriggerWorkflow(
      'Bookmark Update',
      { user_id: interaction.user.id, name, progress, status, notes },
      process.env.N8N_WEBHOOK_SECRET ?? ''
    )
    if ('error' in result) {
      await interaction.editReply(`Error: ${result.error}`)
      return
    }
    const embed = new EmbedBuilder().setTitle('Bookmark Updated').setDescription(`**${name}** updated.`).setColor(0x5865f2).setTimestamp()
    if (progress) embed.addFields({ name: 'Progress', value: progress, inline: true })
    if (status) embed.addFields({ name: 'Status', value: status, inline: true })
    if (notes) embed.addFields({ name: 'Notes', value: notes })
    await interaction.editReply({ embeds: [embed] })
    return
  }

  if (sub === 'delete') {
    await interaction.deferReply({ ephemeral: true })
    const name = interaction.options.getString('name', true)
    const result = await executeTriggerWorkflow(
      'Bookmark Delete',
      { user_id: interaction.user.id, name },
      process.env.N8N_WEBHOOK_SECRET ?? ''
    )
    if ('error' in result) {
      await interaction.editReply(`Error: ${result.error}`)
      return
    }
    await interaction.editReply(`**${name}** removed from bookmarks.`)
  }
}

async function modalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const name = interaction.fields.getTextInputValue('name')
  const type = interaction.fields.getTextInputValue('type').toLowerCase().trim()
  const status = interaction.fields.getTextInputValue('status').toLowerCase().trim()
  const progress = interaction.fields.getTextInputValue('progress') || undefined
  const notes = interaction.fields.getTextInputValue('notes') || undefined

  await interaction.deferReply({ ephemeral: true })

  if (!VALID_TYPES.includes(type)) {
    await interaction.editReply(`Invalid type "${type}". Use one of: ${VALID_TYPES.join(', ')}`)
    return
  }
  if (!VALID_STATUSES.includes(status)) {
    await interaction.editReply(`Invalid status "${status}". Use one of: ${VALID_STATUSES.join(', ')}`)
    return
  }

  const result = await executeTriggerWorkflow(
    'Bookmark Add',
    { user_id: interaction.user.id, name, type, status, progress, notes },
    process.env.N8N_WEBHOOK_SECRET ?? ''
  )

  if ('error' in result) {
    await interaction.editReply(`Error: ${result.error}`)
    return
  }

  const embed = new EmbedBuilder()
    .setTitle('Bookmark Added')
    .addFields(
      { name: 'Name', value: name, inline: true },
      { name: 'Type', value: type, inline: true },
      { name: 'Status', value: status, inline: true },
    )
    .setColor(0x57f287)
    .setTimestamp()
  if (progress) embed.addFields({ name: 'Progress', value: progress, inline: true })
  if (notes) embed.addFields({ name: 'Notes', value: notes })

  await interaction.editReply({ embeds: [embed] })
}

const command: Command = { data, execute, modalSubmit }
export default command
