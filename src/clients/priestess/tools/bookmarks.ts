import { getPool } from '@/clients/db'
import { executeTriggerWorkflow } from '@/clients/n8n-executor'

export async function handleAddBookmark(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  return executeTriggerWorkflow(
    'Bookmark Add',
    { user_id: userId, name: args.name, type: args.type, status: args.status, progress: args.progress ?? null, notes: args.notes ?? null },
    process.env.N8N_WEBHOOK_SECRET ?? '',
  )
}

export async function handleUpdateBookmark(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  return executeTriggerWorkflow(
    'Bookmark Update',
    { user_id: userId, name: args.name, progress: args.progress, status: args.status, notes: args.notes },
    process.env.N8N_WEBHOOK_SECRET ?? '',
  )
}

export async function handleDeleteBookmark(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  return executeTriggerWorkflow(
    'Bookmark Delete',
    { user_id: userId, name: args.name },
    process.env.N8N_WEBHOOK_SECRET ?? '',
  )
}

export async function handleGetBookmarks(args: Record<string, unknown>, userId: string): Promise<Record<string, unknown>> {
  const db = getPool()
  const conditions: string[] = ['user_id = $1']
  const vals: unknown[] = [userId]
  if (args.status) { conditions.push(`status = $${vals.length + 1}`); vals.push(String(args.status)) }
  if (args.type)   { conditions.push(`type = $${vals.length + 1}`);   vals.push(String(args.type)) }
  if (args.name)   { conditions.push(`name ILIKE $${vals.length + 1}`); vals.push(`%${String(args.name)}%`) }
  const result = await db.query(
    `SELECT name, type, status, progress, notes, updated_at FROM bookmarks WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`,
    vals,
  )
  return { bookmarks: result.rows }
}
