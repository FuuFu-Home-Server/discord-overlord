import type { Client } from 'discord.js'

const LOG_CHANNEL_ID = '1492821933795049472'

let discordClient: Client | null = null

export function initLogger(client: Client): void {
  discordClient = client
}

async function sendLog(content: string): Promise<void> {
  if (!discordClient) return
  try {
    const channel = await discordClient.channels.fetch(LOG_CHANNEL_ID)
    if (channel?.isTextBased() && 'send' in channel) {
      await (channel as { send(content: string): Promise<unknown> }).send(content.slice(0, 2000))
    }
  } catch {
    // never let logging crash the bot
  }
}

export async function logPriestessCall(userId: string, message: string, reply: string, durationMs: number): Promise<void> {
  const lines = [
    `**[Priestess]** \`${userId}\``,
    `**In:** ${message.slice(0, 300)}${message.length > 300 ? '…' : ''}`,
    `**Out:** ${reply.slice(0, 300)}${reply.length > 300 ? '…' : ''}`,
    `**Time:** ${durationMs}ms`,
  ]
  await sendLog(lines.join('\n'))
}

export async function logPriestessError(userId: string, message: string, err: unknown): Promise<void> {
  const errorDetail = err instanceof Error
    ? `**${err.name}:** ${err.message}\n\`\`\`\n${err.stack?.slice(0, 800) ?? ''}\n\`\`\``
    : `\`\`\`\n${String(err).slice(0, 800)}\n\`\`\``

  const lines = [
    `**[Priestess ERROR]** \`${userId}\``,
    `**In:** ${message.slice(0, 300)}${message.length > 300 ? '…' : ''}`,
    errorDetail,
  ]
  await sendLog(lines.join('\n'))
}
