import http from 'http'
import { Client, EmbedBuilder } from 'discord.js'
import type { Config } from '../config'
import { chat } from './priestess'

export interface N8nEvent {
  event: string
  title?: string
  message: string
  via?: 'priestess'
  data?: Record<string, unknown>
}

export interface ValidationResult {
  status: number
  error?: string
  payload?: N8nEvent
}

export function validateRequest(body: string, authHeader: string | undefined, secret: string): ValidationResult {
  if (authHeader !== `Bearer ${secret}`) {
    return { status: 401, error: 'Unauthorized' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { status: 400, error: 'Invalid JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { status: 400, error: 'Body must be a JSON object' }
  }
  const p = parsed as Record<string, unknown>
  if (typeof p.event !== 'string' || !p.event) {
    return { status: 400, error: 'Missing required field: event' }
  }
  if (typeof p.message !== 'string' || !p.message) {
    return { status: 400, error: 'Missing required field: message' }
  }
  return {
    status: 200,
    payload: {
      event: p.event,
      title: typeof p.title === 'string' ? p.title : undefined,
      message: p.message,
      via: p.via === 'priestess' ? 'priestess' : undefined,
      data: p.data != null ? (p.data as Record<string, unknown>) : undefined,
    },
  }
}

async function dispatchEvent(client: Client, config: Config, payload: N8nEvent): Promise<void> {
  if (!config.aiChannelId) return
  const channel = client.channels.cache.get(config.aiChannelId)
  if (!channel?.isSendable()) return

  if (payload.via === 'priestess' && config.aiUserId) {
    const { reply } = await chat(config.aiUserId, `[SYSTEM: automation result — ${payload.message}. Relay this to FuuFu in one short, warm sentence. No raw data, no ISO dates — use human-readable time if needed.]`)
    await channel.send(`<@${config.aiUserId}> ${reply}`).catch((err: Error) => {
      console.error('webhook-server: failed to send priestess reply:', err)
    })
    return
  }

  const embed = new EmbedBuilder()
    .setTitle(payload.title ?? payload.event)
    .setDescription(payload.message)
    .setFooter({ text: `event: ${payload.event}` })
    .setColor(0x5865f2)
    .setTimestamp()

  if (payload.data) {
    const json = JSON.stringify(payload.data, null, 2)
    const truncated = json.length > 900 ? json.slice(0, 900) + '…' : json
    embed.addFields({ name: 'Data', value: `\`\`\`json\n${truncated}\n\`\`\`` })
  }

  await channel.send({ embeds: [embed] }).catch((err: Error) => {
    console.error('webhook-server: failed to send embed:', err)
  })
}

const MAX_BYTES = 1_048_576

export function startWebhookServer(client: Client, config: Config): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook') {
      res.writeHead(404).end()
      return
    }

    let body = ''
    let bytes = 0
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > MAX_BYTES) {
        res.writeHead(413).end()
        req.destroy()
        return
      }
      body += chunk.toString()
    })
    req.on('end', () => {
      if (res.writableEnded) return
      const result = validateRequest(body, req.headers['authorization'], config.n8nWebhookSecret)
      if (result.status !== 200 || !result.payload) {
        res.writeHead(result.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: result.error }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      void dispatchEvent(client, config, result.payload)
    })
  })

  server.on('error', (err) => console.error('webhook-server error:', err))

  server.listen(config.webhookPort, () => {
    console.log(`Webhook server listening on :${config.webhookPort}`)
  })
  return server
}
