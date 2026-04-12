import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import type { Command } from '../../types'
import { post } from '../../clients/http'
import type { AxiosError } from 'axios'

let apiUrl = ''
let apiKey = ''
let worklogRoleId = ''

const data = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Log a work task')
  .addStringOption(opt => opt.setName('summary').setDescription('Task title').setRequired(true))
  .addStringOption(opt => opt.setName('duration').setDescription('Time spent e.g. 1h30m, 45m, 2h10m30s').setRequired(true))
  .addStringOption(opt => opt.setName('description').setDescription('Longer details (optional)').setRequired(false))
  .addStringOption(opt => opt.setName('date').setDescription('ISO 8601 start time (optional, defaults to now)').setRequired(false))

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

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(worklogRoleId)) {
    await interaction.reply({ content: 'You need the worklog role to use this command.', ephemeral: true })
    return
  }

  const summary = interaction.options.getString('summary', true)
  const duration = interaction.options.getString('duration', true)
  const description = interaction.options.getString('description') ?? undefined
  const date = interaction.options.getString('date') ?? undefined

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

const command = { data, execute, setWorklogConfig } as Command & { setWorklogConfig: typeof setWorklogConfig }
export default command
