import { getPool } from '@/clients/db'

export async function getNotesBlock(userId: string): Promise<string> {
  try {
    const db = getPool()
    const result = await db.query(
      'SELECT key, value FROM priestess_notes WHERE user_id = $1 ORDER BY key ASC',
      [userId],
    )
    const rows = result.rows as { key: string; value: string }[]
    if (rows.length === 0) return ''
    return `\n\nWhat I remember about FuuFu:\n${rows.map(r => `- ${r.key}: ${r.value}`).join('\n')}`
  } catch {
    return ''
  }
}

export async function handleAddNote(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const title = args.title ? String(args.title).trim() : ''
  if (!title) return { error: 'Title is required. Please provide a title for this note.' }
  const db = getPool()
  const result = await db.query(
    'INSERT INTO priestess_todos (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
    [userId, title, String(args.content)],
  )
  return { ok: true, id: result.rows[0].id }
}

export async function handleListNotes(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const db = getPool()
  const filter = String(args.filter ?? 'pending')
  const whereClause = filter === 'done' ? 'done = TRUE' : filter === 'all' ? 'TRUE' : 'done = FALSE'
  const result = await db.query(
    `SELECT id, title, content, done, created_at FROM priestess_todos WHERE user_id = $1 AND ${whereClause} ORDER BY created_at DESC LIMIT 50`,
    [userId],
  )
  return { notes: result.rows }
}

export async function handleCompleteNote(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const db = getPool()
  const result = await db.query(
    `UPDATE priestess_todos SET done = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND done = FALSE AND (title ILIKE $2 OR content ILIKE $2)
     RETURNING id, title, content`,
    [userId, `%${String(args.match)}%`],
  )
  if (result.rows.length === 0) return { error: 'No matching pending note found.' }
  return { ok: true, updated: result.rows }
}

export async function handleDeleteNote(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const db = getPool()
  const result = await db.query(
    'DELETE FROM priestess_todos WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2) RETURNING id, title, content',
    [userId, `%${String(args.match)}%`],
  )
  if (result.rows.length === 0) return { error: 'No matching note found.' }
  return { ok: true, deleted: result.rows }
}

export async function handleRememberNote(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const db = getPool()
  await db.query(
    `INSERT INTO priestess_notes (user_id, key, value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
    [userId, String(args.key), String(args.value)],
  )
  return { ok: true, key: args.key }
}

export async function handleForgetNote(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const db = getPool()
  await db.query(
    'DELETE FROM priestess_notes WHERE user_id = $1 AND key = $2',
    [userId, String(args.key)],
  )
  return { ok: true, key: args.key }
}
