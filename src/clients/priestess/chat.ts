import { GoogleGenAI } from '@google/genai'
import { readFileSync } from 'fs'
import path from 'path'
import { getPool } from '@/clients/db'
import { getHistory, saveMessage } from './history'
import { getPersona } from './persona'
import { FUNCTION_DECLARATIONS } from './tools/declarations'
import { executeFunction } from './tools/index'
import { getNotesBlock } from './tools/notes'

export interface ChatResult {
  reply: string
  promptTokens: number
  outputTokens: number
  totalTokens: number
}

const MODEL = 'gemini-2.5-flash'

let ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })
  return ai
}

async function buildWorkflowsBlock(): Promise<string> {
  try {
    const db = getPool()
    const wfResult = await db.query('SELECT name, description FROM n8n_workflows ORDER BY name ASC')
    const schemasPath = path.join(__dirname, '../../../workflows/schemas.json')
    let schemas: Record<string, { fields: { name: string; type: string; required: boolean; description: string; default?: unknown }[] }> = {}
    try {
      const raw = readFileSync(schemasPath, 'utf8')
      schemas = (JSON.parse(raw) as { workflows: typeof schemas }).workflows ?? {}
    } catch { /* ignore */ }
    const schemasLower = Object.fromEntries(
      Object.entries(schemas).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, '_'), v]),
    )
    const lines = (wfResult.rows as { name: string; description: string | null }[]).map(r => {
      const schema = schemas[r.name] ?? schemasLower[r.name.toLowerCase().replace(/\s+/g, '_')]
      const fields = schema?.fields.map(f =>
        `    - ${f.name} (${f.type}${f.required ? ', required' : ', optional'}${f.default !== undefined ? `, default: ${f.default}` : ''}): ${f.description}`
      ).join('\n') ?? '    (no schema)'
      return `- ${r.name}: ${r.description ?? ''}\n${fields}`
    })
    if (lines.length > 0) return `\n\nAvailable n8n workflows (call trigger_n8n_workflow directly using these):\n${lines.join('\n')}`
  } catch { /* ignore */ }
  return ''
}

export async function chat(userId: string, message: string): Promise<ChatResult> {
  const [persona, history, notesBlock, workflowsBlock] = await Promise.all([
    getPersona(userId),
    getHistory(userId),
    getNotesBlock(userId),
    buildWorkflowsBlock(),
  ])

  const nowWIB = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })
  const systemInstruction = `${persona}\n\nCurrent date and time (WIB, UTC+7): ${nowWIB}${notesBlock}${workflowsBlock}`
  const tools = [{ functionDeclarations: FUNCTION_DECLARATIONS }]
  const config = { systemInstruction, tools }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...history.map(({ role, content }) => ({ role, parts: [{ text: content }] })),
    { role: 'user', parts: [{ text: message }] },
  ]

  let response = await getAI().models.generateContent({ model: MODEL, contents, config })
  let promptTokens = response.usageMetadata?.promptTokenCount ?? 0
  let outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0
  const toolCallLog: string[] = []

  while (response.functionCalls && response.functionCalls.length > 0) {
    const calls = response.functionCalls
    console.log('[priestess] function calls:', calls.map(c => `${c.name}(${JSON.stringify(c.args)})`).join(', '))
    toolCallLog.push(...calls.map(c => `${c.name}(${JSON.stringify(c.args)})`))

    const results = await Promise.all(
      calls.map(async (call) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await executeFunction(call.name ?? '', (call.args ?? {}) as Record<string, any>, userId)
        console.log(`[priestess] ${call.name} →`, JSON.stringify(result).slice(0, 200))
        return { name: call.name ?? '', response: result, id: call.id ?? '' }
      }),
    )

    contents.push({ role: 'model', parts: calls.map(fc => ({ functionCall: fc })) })
    contents.push({ role: 'user', parts: results.map(r => ({ functionResponse: r })) })

    response = await getAI().models.generateContent({ model: MODEL, contents, config })
    promptTokens += response.usageMetadata?.promptTokenCount ?? 0
    outputTokens += response.usageMetadata?.candidatesTokenCount ?? 0
  }

  const reply = response.text?.trim() || '_(no response)_'
  const totalTokens = promptTokens + outputTokens
  const savedReply = toolCallLog.length > 0 ? `[tool_calls: ${toolCallLog.join('; ')}]\n${reply}` : reply

  const db = getPool()
  await Promise.all([
    saveMessage(userId, 'user', message),
    saveMessage(userId, 'model', savedReply),
    db.query(
      'INSERT INTO ai_token_usage (user_id, prompt_tokens, output_tokens, total_tokens) VALUES ($1, $2, $3, $4)',
      [userId, promptTokens, outputTokens, totalTokens],
    ),
  ])

  return { reply, promptTokens, outputTokens, totalTokens }
}

export async function notify(userId: string, message: string): Promise<string> {
  const [persona, notesBlock] = await Promise.all([getPersona(userId), getNotesBlock(userId)])
  const nowWIB = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })
  const systemInstruction = `${persona}\n\nCurrent date and time (WIB, UTC+7): ${nowWIB}${notesBlock}`
  const contents = [{ role: 'user', parts: [{ text: message }] }]
  const response = await getAI().models.generateContent({ model: MODEL, contents, config: { systemInstruction } })
  return response.text?.trim() || '_(no response)_'
}
