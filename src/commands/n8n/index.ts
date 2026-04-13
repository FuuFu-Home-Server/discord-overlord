import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js'
import type { Command } from '../../types'
import { getPool } from '../../clients/db'
import { executeTriggerWorkflow } from '../../clients/n8n-executor'

let adminRoleId = ''
export function setAdminRoleId(id: string): void { adminRoleId = id }

const data = new SlashCommandBuilder()
  .setName('n8n')
  .setDescription('Manage n8n workflow integrations')
  .addSubcommand(sub =>
    sub.setName('trigger')
      .setDescription('Trigger a registered workflow by name')
      .addStringOption(opt =>
        opt.setName('name').setDescription('Workflow name').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('payload').setDescription('JSON payload to pass (optional)').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('register')
      .setDescription('Register or update a workflow in the registry (admin only)')
      .addStringOption(opt =>
        opt.setName('name').setDescription('Workflow name (used to trigger it)').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('url').setDescription('n8n webhook URL').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('description').setDescription('What this workflow does (optional)').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List all registered workflows')
  )

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand()

  if (sub === 'list') {
    await interaction.deferReply({ ephemeral: true })
    const db = getPool()
    const result = await db.query('SELECT name, description FROM n8n_workflows ORDER BY name ASC')
    if (result.rows.length === 0) {
      await interaction.editReply('No workflows registered. Use `/n8n register` to add one.')
      return
    }
    const lines = (result.rows as { name: string; description: string | null }[]).map(row =>
      `**${row.name}**${row.description ? ` — ${row.description}` : ''}`
    )
    const description = lines.join('\n')
    const embed = new EmbedBuilder()
      .setTitle('Registered n8n Workflows')
      .setDescription(description.length > 4000 ? description.slice(0, 4000) + '\n…' : description)
      .setColor(0x5865f2)
      .setTimestamp()
    await interaction.editReply({ embeds: [embed] })
    return
  }

  if (sub === 'register') {
    const member = interaction.member as GuildMember
    if (!member.roles.cache.has(adminRoleId)) {
      await interaction.reply({ content: 'You need the admin role to register workflows.', ephemeral: true })
      return
    }
    await interaction.deferReply({ ephemeral: true })
    const name = interaction.options.getString('name', true).trim().toLowerCase().replace(/\s+/g, '_')
    const url = interaction.options.getString('url', true).trim()
    try { new URL(url) } catch {
      await interaction.editReply('Invalid URL format.')
      return
    }
    const description = interaction.options.getString('description') ?? null
    const db = getPool()
    await db.query(`
      INSERT INTO n8n_workflows (name, webhook_url, description, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (name) DO UPDATE SET webhook_url = $2, description = $3, updated_at = NOW()
    `, [name, url, description])
    await interaction.editReply(`Workflow **${name}** registered.`)
    return
  }

  if (sub === 'trigger') {
    await interaction.deferReply()
    const name = interaction.options.getString('name', true).trim().toLowerCase().replace(/\s+/g, '_')
    const rawPayload = interaction.options.getString('payload')
    let payload: Record<string, unknown> | undefined
    if (rawPayload) {
      try {
        payload = JSON.parse(rawPayload) as Record<string, unknown>
      } catch {
        await interaction.editReply('Invalid JSON in payload argument.')
        return
      }
    }
    const result = await executeTriggerWorkflow(name, payload, process.env.N8N_WEBHOOK_SECRET ?? '')
    if ('error' in result) {
      await interaction.editReply(`Error: ${result.error}`)
    } else {
      await interaction.editReply(`Workflow **${name}** triggered successfully.`)
    }
  }
}

const command: Command = { data, execute }
export default command
