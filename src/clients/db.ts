import { Pool } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

export async function initDb(): Promise<void> {
  const db = getPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_persona (
      user_id TEXT PRIMARY KEY,
      system_prompt TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS ai_messages_user_id_idx ON ai_messages (user_id, created_at DESC)`)
  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_token_usage (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      prompt_tokens INT NOT NULL DEFAULT 0,
      output_tokens INT NOT NULL DEFAULT 0,
      total_tokens INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS ai_token_usage_user_id_idx ON ai_token_usage (user_id, created_at DESC)`)
  await db.query(`
    CREATE TABLE IF NOT EXISTS n8n_workflows (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      webhook_url TEXT NOT NULL,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS priestess_notes (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, key)
    )
  `)
  await db.query(`CREATE INDEX IF NOT EXISTS priestess_notes_user_id_idx ON priestess_notes (user_id)`)
}
