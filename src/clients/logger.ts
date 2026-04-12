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

export async function logStartup(tag: string): Promise<void> {
  await sendLog(`I'm back. \`${tag}\` — ${new Date().toISOString()}`)
}

export async function logPriestessCall(userId: string, message: string, reply: string, durationMs: number): Promise<void> {
  const lines = [
    `**He said:** ${message.slice(0, 300)}${message.length > 300 ? '…' : ''}`,
    `**I said:** ${reply.slice(0, 300)}${reply.length > 300 ? '…' : ''}`,
    `*${durationMs}ms — \`${userId}\`*`,
  ]
  await sendLog(lines.join('\n'))
}

export async function logPriestessError(userId: string, message: string, err: unknown): Promise<void> {
  const errorDetail = err instanceof Error
    ? `**${err.name}:** ${err.message}\n\`\`\`\n${err.stack?.slice(0, 800) ?? ''}\n\`\`\``
    : `\`\`\`\n${String(err).slice(0, 800)}\n\`\`\``

  const lines = [
    `Something went wrong while I was attending to \`${userId}\`.`,
    `**He said:** ${message.slice(0, 300)}${message.length > 300 ? '…' : ''}`,
    errorDetail,
  ]
  await sendLog(lines.join('\n'))
}
