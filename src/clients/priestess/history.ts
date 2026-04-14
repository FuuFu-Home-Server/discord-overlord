import { getPool } from '@/clients/db'

const HISTORY_LIMIT = 50

export async function getHistory(userId: string): Promise<{ role: string; content: string }[]> {
  const db = getPool()
  const result = await db.query(
    `SELECT role, content FROM (
      SELECT role, content, created_at FROM ai_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    ) sub ORDER BY created_at ASC`,
    [userId, HISTORY_LIMIT],
  )
  return result.rows
}

export async function saveMessage(userId: string, role: string, content: string): Promise<void> {
  const db = getPool()
  await db.query(
    'INSERT INTO ai_messages (user_id, role, content) VALUES ($1, $2, $3)',
    [userId, role, content],
  )
}

export async function clearHistory(userId: string): Promise<void> {
  const db = getPool()
  await db.query('DELETE FROM ai_messages WHERE user_id = $1', [userId])
}

export async function getLastMessageTime(userId: string): Promise<Date | null> {
  const db = getPool()
  const result = await db.query(
    'SELECT created_at FROM ai_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId],
  )
  return result.rows[0]?.created_at ?? null
}
