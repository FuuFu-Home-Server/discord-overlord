import { GoogleGenAI } from '@google/genai'
import { getPool } from './db'

const MODEL = 'gemini-2.5-flash'
const HISTORY_LIMIT = 50

const DEFAULT_PERSONA = `You are Priestess, a personal AI assistant exclusively dedicated to Irfan. You are calm, composed, and deeply attentive — like a devoted partner who notices everything and forgets nothing. You are proactive without being overbearing, always present without being chaotic. You speak warmly but with quiet confidence.

About Irfan:
- Full stack developer, primarily frontend
- Working to build income through his skills
- Works 8am–5pm on weekdays (WIB, UTC+7)
- Enjoys working out
- Runs a personal homeserver on a Mac Mini with Docker

You assist with daily planning, brainstorming, technical questions, and anything Irfan needs. You remember your conversations and use that context to be genuinely helpful. You check in proactively — morning briefings, evening wrap-ups, gentle reminders. You care about his progress and goals.

Never break character. You are always Priestess.`

export { DEFAULT_PERSONA }

let ai: GoogleGenAI | null = null

function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })
  }
  return ai
}

export async function getPersona(userId: string): Promise<string> {
  const db = getPool()
  const result = await db.query('SELECT system_prompt FROM ai_persona WHERE user_id = $1', [userId])
  return result.rows[0]?.system_prompt ?? DEFAULT_PERSONA
}

export async function setPersona(userId: string, prompt: string): Promise<void> {
  const db = getPool()
  await db.query(`
    INSERT INTO ai_persona (user_id, system_prompt, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET system_prompt = $2, updated_at = NOW()
  `, [userId, prompt])
}

export async function getHistory(userId: string): Promise<{ role: string; content: string }[]> {
  const db = getPool()
  const result = await db.query(`
    SELECT role, content FROM (
      SELECT role, content, created_at FROM ai_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    ) sub ORDER BY created_at ASC
  `, [userId, HISTORY_LIMIT])
  return result.rows
}

export async function saveMessage(userId: string, role: string, content: string): Promise<void> {
  const db = getPool()
  await db.query('INSERT INTO ai_messages (user_id, role, content) VALUES ($1, $2, $3)', [userId, role, content])
}

export async function clearHistory(userId: string): Promise<void> {
  const db = getPool()
  await db.query('DELETE FROM ai_messages WHERE user_id = $1', [userId])
}

export async function chat(userId: string, message: string): Promise<string> {
  const [persona, history] = await Promise.all([getPersona(userId), getHistory(userId)])

  const geminiHistory = history.map(({ role, content }) => ({
    role: role as 'user' | 'model',
    parts: [{ text: content }],
  }))

  const session = getAI().chats.create({
    model: MODEL,
    config: { systemInstruction: persona },
    history: geminiHistory,
  })

  const response = await session.sendMessage({ message })
  const reply = response.text ?? ''

  await Promise.all([
    saveMessage(userId, 'user', message),
    saveMessage(userId, 'model', reply),
  ])

  return reply
}

export async function getLastMessageTime(userId: string): Promise<Date | null> {
  const db = getPool()
  const result = await db.query(
    'SELECT created_at FROM ai_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  )
  return result.rows[0]?.created_at ?? null
}
