import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
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
        opt.setName('name').setDescription('Workflow name').setRequired(true).setAutocomplete(true)
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
        opt.setName('description').setDescription('What this workflow does').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('schema').setDescription('Payload schema as JSON object e.g. {"title":"string","datetime":"ISO8601"}').setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List all registered workflows')
  )
  .addSubcommand(sub =>
    sub.setName('set-schema')
      .setDescription('Update the payload schema for a registered workflow (admin only)')
      .addStringOption(opt =>
        opt.setName('name').setDescription('Workflow name').setRequired(true).setAutocomplete(true)
      )
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
    const description = interaction.options.getString('description', true).trim()
    const rawSchema = interaction.options.getString('schema')
    let payloadSchema: Record<string, unknown> | null = null
    if (rawSchema) {
      try {
        payloadSchema = JSON.parse(rawSchema) as Record<string, unknown>
      } catch {
        await interaction.editReply('Invalid JSON in schema argument.')
        return
      }
    }
    const db = getPool()
    await db.query(`
      INSERT INTO n8n_workflows (name, webhook_url, description, payload_schema, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (name) DO UPDATE SET webhook_url = $2, description = $3, payload_schema = $4, updated_at = NOW()
    `, [name, url, description, payloadSchema ? JSON.stringify(payloadSchema) : null])
    await interaction.editReply(`Workflow **${name}** registered.`)
    return
  }

  if (sub === 'set-schema') {
    const member = interaction.member as GuildMember
    if (!member.roles.cache.has(adminRoleId)) {
      await interaction.reply({ content: 'You need the admin role to update schemas.', ephemeral: true })
      return
    }
    const name = interaction.options.getString('name', true).trim()
    const db = getPool()
    const existing = await db.query('SELECT payload_schema FROM n8n_workflows WHERE LOWER(name) = LOWER($1)', [name])
    if (existing.rowCount === 0) {
      await interaction.reply({ content: `Workflow **${name}** not found.`, ephemeral: true })
      return
    }
    const currentSchema = existing.rows[0].payload_schema
      ? JSON.stringify(existing.rows[0].payload_schema, null, 2)
      : '{}'
    const modal = new ModalBuilder()
      .setCustomId(`n8n:set-schema:${name}`)
      .setTitle(`Schema — ${name}`)
    const input = new TextInputBuilder()
      .setCustomId('schema')
      .setLabel('Payload schema (JSON)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(currentSchema)
      .setRequired(true)
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
    await interaction.showModal(modal)
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

async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  try {
    const focused = interaction.options.getFocused()
    const db = getPool()
    const result = await db.query('SELECT name FROM n8n_workflows ORDER BY name ASC')
    const choices = (result.rows as { name: string }[])
      .filter(r => r.name.toLowerCase().includes(focused.toLowerCase()))
      .slice(0, 25)
      .map(r => ({ name: r.name, value: r.name }))
    await interaction.respond(choices)
  } catch {
    await interaction.respond([])
  }
}

async function modalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  // customId format: n8n:set-schema:<workflow name>
  const name = interaction.customId.split(':').slice(2).join(':')
  const rawSchema = interaction.fields.getTextInputValue('schema')
  let payloadSchema: Record<string, unknown>
  try {
    payloadSchema = JSON.parse(rawSchema) as Record<string, unknown>
  } catch {
    await interaction.reply({ content: 'Invalid JSON — schema not saved.', ephemeral: true })
    return
  }
  const db = getPool()
  const result = await db.query(
    'UPDATE n8n_workflows SET payload_schema = $1, updated_at = NOW() WHERE LOWER(name) = LOWER($2) RETURNING name',
    [JSON.stringify(payloadSchema), name]
  )
  if (result.rowCount === 0) {
    await interaction.reply({ content: `Workflow **${name}** not found.`, ephemeral: true })
    return
  }
  await interaction.reply({ content: `Schema updated for **${result.rows[0].name}**.`, ephemeral: true })
}

const command: Command = { data, execute, autocomplete, modalSubmit }
export default command
