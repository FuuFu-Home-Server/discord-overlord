import { execFileSync } from 'child_process'
import type { Client } from 'discord.js'
import type { ChatResult } from './priestess'

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
  let commit = ''
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch { /* not in git repo or git unavailable */ }
  const build = commit ? ` · \`${commit}\`` : ''
  await sendLog(`I'm back. \`${tag}\`${build} — ${new Date().toISOString()}`)
}

export async function logPriestessCall(userId: string, message: string, result: ChatResult, durationMs: number): Promise<void> {
  const lines = [
    `**FuuFu said:** ${message.slice(0, 300)}${message.length > 300 ? '…' : ''}`,
    `**I said:** ${result.reply.slice(0, 300)}${result.reply.length > 300 ? '…' : ''}`,
    `*${durationMs}ms · ${result.totalTokens} tokens (${result.promptTokens} in / ${result.outputTokens} out) — \`${userId}\`*`,
  ]
  await sendLog(lines.join('\n'))
}

export async function logPriestessError(userId: string, message: string, err: unknown): Promise<void> {
  const errorDetail = err instanceof Error
    ? `**${err.name}:** ${err.message}\n\`\`\`\n${err.stack?.slice(0, 800) ?? ''}\n\`\`\``
    : `\`\`\`\n${String(err).slice(0, 800)}\n\`\`\``

  const lines = [
    `Something went wrong while I was attending to FuuFu.`,
    `**FuuFu said:** ${message.slice(0, 300)}${message.length > 300 ? '…' : ''}`,
    errorDetail,
  ]
  await sendLog(lines.join('\n'))
}
