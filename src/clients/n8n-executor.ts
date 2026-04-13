import axios from 'axios'
import { getPool } from './db'

export async function executeTriggerWorkflow(
  name: string,
  payload: Record<string, unknown> | undefined,
  secret: string
): Promise<Record<string, unknown>> {
  if (!name.trim()) return { error: 'Workflow name must not be empty.' }
  const db = getPool()
  const result = await db.query('SELECT webhook_url FROM n8n_workflows WHERE LOWER(name) = LOWER($1)', [name])
  if (!result.rows[0]) {
    return { error: `Workflow "${name}" not found. Use /n8n list to see registered workflows.` }
  }
  const { webhook_url } = result.rows[0] as { webhook_url: string }
  try {
    await axios.post(webhook_url, payload ?? {}, {
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })
    return { success: true, workflow: name }
  } catch (err) {
    return { error: `Failed to trigger workflow "${name}": ${(err as Error).message}` }
  }
}
