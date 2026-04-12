import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord-api-types/v10'
import type { ChatInputCommandInteraction, AutocompleteInteraction, ModalSubmitInteraction } from 'discord.js'

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody }
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>
  modalSubmit?: (interaction: ModalSubmitInteraction) => Promise<void>
}
