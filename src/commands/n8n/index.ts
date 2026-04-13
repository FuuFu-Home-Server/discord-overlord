import type { Command } from '../../types'
import { SlashCommandBuilder } from 'discord.js'
let adminRoleId = ''
export function setAdminRoleId(id: string): void { adminRoleId = id }
void adminRoleId
const data = new SlashCommandBuilder().setName('n8n').setDescription('n8n integration')
const command: Command = { data, execute: async () => {} }
export default command
