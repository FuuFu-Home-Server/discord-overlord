import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'
import type { Command } from '../../types'
import { post } from '../../clients/http'
import type { AxiosError } from 'axios'

let apiUrl = ''
let apiKey = ''
let worklogRoleId = ''

const data = new SlashCommandBuilder()
  .setName('log')
  .setDescription('Log a work entry')
  .addStringOption(opt => opt.setName('work').setDescription('Work name / project').setRequired(true))
  .addStringOption(opt => opt.setName('date').setDescription('Date (YYYY-MM-DD)').setRequired(true))
  .addStringOption(opt => opt.setName('time_spent').setDescription('Time spent (e.g. 2h30m)').setRequired(true))

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember
  if (!member.roles.cache.has(worklogRoleId)) {
    await interaction.reply({ content: 'You need the worklog role to use this command.', ephemeral: true })
    return
  }
  const work = interaction.options.getString('work', true)
  const date = interaction.options.getString('date', true)
  const time_spent = interaction.options.getString('time_spent', true)
  await interaction.deferReply()
  try {
    await post(apiUrl, { work, date, time_spent }, {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    })
    const embed = new EmbedBuilder()
      .setTitle('Work Logged')
      .addFields(
        { name: 'Work', value: work, inline: true },
        { name: 'Date', value: date, inline: true },
        { name: 'Time Spent', value: time_spent, inline: true },
      )
      .setColor(0x57f287)
      .setTimestamp()
    await interaction.editReply({ embeds: [embed] })
  } catch (err) {
    const axiosErr = err as AxiosError<{ message?: string }>
    const msg = axiosErr.response?.data?.message ?? (err as Error).message
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
