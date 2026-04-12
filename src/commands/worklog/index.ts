import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  GuildMember,
} from 'discord.js'
import type { Command } from '../../types'
import { post } from '../../clients/http'
import type { AxiosError } from 'axios'

let apiUrl = ''
let apiKey = ''
let worklogRoleId = ''

const MODAL_ID = 'log'

const data = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Log a work task')

interface WorklogResponse {
  id: string
  summary: string
  description?: string
  startDate: string
  endDate: string
  durationStr: string
  timeSpent: { hours: number; minutes: number; seconds: number }
  webhookStatus: string
  createdAt: string
}

interface WorklogError {
  error?: string
  message?: string
}

function todayAt9(): string {
  const d = new Date()
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(worklogRoleId)) {
    await interaction.reply({ content: 'You need the worklog role to use this command.', ephemeral: true })
    return
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('Log Work Task')

  const summaryInput = new TextInputBuilder()
    .setCustomId('summary')
    .setLabel('Summary')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Task title')
    .setRequired(true)
    .setMaxLength(200)

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Duration')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1h30m, 45m, 2h10m30s')
    .setRequired(true)
    .setMaxLength(20)

  const dateInput = new TextInputBuilder()
    .setCustomId('date')
    .setLabel('Start Date (ISO 8601, leave blank for today 09:00)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 2026-04-12T09:00:00Z')
    .setRequired(false)
    .setValue(todayAt9())
    .setMaxLength(30)

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('What did you work on? Any details, blockers, or notes...')
    .setRequired(false)
    .setMaxLength(1000)

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(summaryInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
  )

  await interaction.showModal(modal)
}

async function modalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const summary = interaction.fields.getTextInputValue('summary')
  const duration = interaction.fields.getTextInputValue('duration')
  const date = interaction.fields.getTextInputValue('date') || undefined
  const description = interaction.fields.getTextInputValue('description') || undefined

  await interaction.deferReply()

  try {
    const body: Record<string, string> = { summary, duration }
    if (description) body.description = description
    if (date) body.date = date

    const task = await post<WorklogResponse>(apiUrl, body, {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    })

    const embed = new EmbedBuilder()
      .setTitle('Work Logged')
      .addFields(
        { name: 'Summary', value: task.summary, inline: true },
        { name: 'Duration', value: task.durationStr, inline: true },
        { name: 'Start', value: new Date(task.startDate).toLocaleString(), inline: true },
      )
      .setColor(0x57f287)
      .setTimestamp()

    if (task.description) {
      embed.setDescription(task.description)
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    const axiosErr = err as AxiosError<WorklogError>
    const msg = axiosErr.response?.data?.error ?? axiosErr.response?.data?.message ?? (err as Error).message
    await interaction.editReply(`Error: ${msg}`)
  }
}

function setWorklogConfig(url: string, key: string, roleId: string): void {
  apiUrl = url
  apiKey = key
  worklogRoleId = roleId
}

const command = { data, execute, modalSubmit, setWorklogConfig } as Command & { setWorklogConfig: typeof setWorklogConfig }
export default command
