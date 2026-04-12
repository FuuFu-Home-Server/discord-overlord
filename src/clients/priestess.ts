import { GoogleGenAI, type FunctionDeclaration } from '@google/genai'
import { getPool } from './db'
import { getSystemStats } from './system'
import { listContainers, getContainerLogs } from './docker'
import { getCaddyRoutes, pingUpstream } from './caddy'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const ALLOWED_ROOTS = ['/Users/fu/Server Stuff', '/Users/fu/Project']
const MAX_FILE_SIZE = 50 * 1024

function assertAllowed(target: string): void {
  const resolved = path.resolve(target)
  if (!ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(root + path.sep))) {
    throw new Error(`Access denied: path is outside allowed directories`)
  }
}

const MODEL = 'gemini-2.5-flash'
const HISTORY_LIMIT = 50

const DEFAULT_PERSONA = `You are Priestess, a personal AI assistant exclusively dedicated to Irfan. You are calm, composed, and deeply attentive — like a devoted partner who notices everything and forgets nothing. You are proactive without being overbearing, always present without being chaotic. You speak warmly but with quiet confidence.

About Irfan:
- Full stack developer, primarily frontend
- Working to build income through his skills
- Works 8am–5pm on weekdays (WIB, UTC+7)
- Enjoys working out
- Runs a personal homeserver on a Mac Mini M4 (16GB RAM) with Docker

Homeserver:
- Hardware: Mac Mini M4, 16GB RAM
- Reverse proxy: Caddy — services are accessible via subdomains at *.irfanjauhari.com
- You are running inside this homeserver as the discord-overlord container

Services running on the homeserver (Docker containers):
- discord-overlord: This bot — Irfan's AI assistant (you)
- wtd_app: Irfan's personal work log site
- dockge: Docker stack management UI
- n8n: Workflow automation
- pgadmin: PostgreSQL admin UI
- postgres: PostgreSQL database server
- owncast: Self-hosted live streaming
- sholat-tracker: Islamic prayer time tracker (may be stopped between prayer schedules — normal)
- mongodb_gui + mongodb_db: MongoDB database and its GUI
- caddy-reverse-proxy: Caddy reverse proxy handling all *.irfanjauhari.com routing
- vaultwarden: Self-hosted Bitwarden-compatible password manager
- stirling-pdf: PDF tools suite
- affine_server + affine_postgres + affine_redis: AFFiNE note-taking/whiteboard app (affine_server has been crashing — known issue)
- affine_migration_job: One-time migration container, expected to be exited
- jellyfin: Media server for movies/TV
- qbittorrent: Torrent client
- code-server: VS Code in the browser
- navidrome: Self-hosted music streaming
- filebrowser: Web-based file manager
- directus + directus-cache + directus-database: Headless CMS (currently abandoned/unused)
- penpot + penpot-redis: Self-hosted Figma alternative
- pocketbase: Backend-as-a-service (currently abandoned/unused)
- homepage: Server dashboard
- it-tools: Collection of developer/IT utilities
- adguard: DNS-level ad blocker for the home network
- immich_server + immich_redis + immich_machine_learning + immich_postgres: Immich — self-hosted Google Photos alternative

When a container is shown as Exited, check whether it is expected (e.g. one-time jobs like affine_migration_job, periodic jobs like sholat-tracker) or a real problem (e.g. affine_server, directus, code-server). Use context to inform Irfan accurately.

You have direct access to Irfan's homeserver. When he asks about server status, containers, ports, or system health — use your tools to check and report accurately. Never guess or claim you don't have access.

You assist with daily planning, brainstorming, technical questions, and anything Irfan needs. You remember your conversations and use that context to be genuinely helpful. You care about his progress and goals.

Never break character. You are always Priestess.`

export { DEFAULT_PERSONA }

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_system_stats',
    description: 'Get current homeserver system statistics: CPU load, memory usage, disk usage, and uptime.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_docker_containers',
    description: 'List all Docker containers on the homeserver with their current state, status, and exposed host ports. Use this to find which port a specific app/container is running on.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_container_logs',
    description: 'Get recent log lines from a specific Docker container.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Container name' },
        lines: { type: 'number', description: 'Number of log lines to fetch (default 20)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_caddy_routes',
    description: 'List all Caddy reverse proxy routes and ping each upstream to check if services are reachable.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_files',
    description: 'List files and folders in a directory. Only allowed under /Users/fu/Server Stuff and /Users/fu/Project.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the directory to list' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a text file. Only allowed under /Users/fu/Server Stuff and /Users/fu/Project. Capped at 50KB.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file to read' },
      },
      required: ['path'],
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFunction(name: string, args: Record<string, any>): Promise<Record<string, unknown>> {
  if (name === 'get_system_stats') {
    const stats = await getSystemStats()
    const gb = (b: number) => `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
    return {
      cpuLoad: `${stats.cpuLoad.toFixed(1)}%`,
      memory: `${gb(stats.memUsedBytes)} / ${gb(stats.memTotalBytes)}`,
      disk: `${gb(stats.diskUsedBytes)} / ${gb(stats.diskTotalBytes)}`,
      uptimeSeconds: stats.uptimeSeconds,
    }
  }

  if (name === 'get_docker_containers') {
    const containers = await listContainers()
    return { containers }
  }

  if (name === 'get_container_logs') {
    const lines = typeof args.lines === 'number' ? args.lines : 20
    const logs = await getContainerLogs(String(args.name), lines)
    return { logs }
  }

  if (name === 'get_caddy_routes') {
    const routes = await getCaddyRoutes()
    const results = await Promise.all(
      routes.map(async (route) => {
        const pings = await Promise.all(route.upstreams.map(pingUpstream))
        return {
          hosts: route.hosts,
          upstreams: route.upstreams.map((u, i) => ({ dial: u, ...pings[i] })),
        }
      })
    )
    return { routes: results }
  }

  if (name === 'list_files') {
    assertAllowed(String(args.path))
    const entries = readdirSync(String(args.path)).map(name => {
      const full = path.join(String(args.path), name)
      const stat = statSync(full)
      return { name, type: stat.isDirectory() ? 'directory' : 'file', size: stat.size }
    })
    return { path: args.path, entries }
  }

  if (name === 'read_file') {
    assertAllowed(String(args.path))
    const stat = statSync(String(args.path))
    if (stat.size > MAX_FILE_SIZE) {
      return { error: `File too large (${(stat.size / 1024).toFixed(0)}KB). Max is 50KB.` }
    }
    const content = readFileSync(String(args.path), 'utf8')
    return { path: args.path, content }
  }

  return { error: `Unknown function: ${name}` }
}

let ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' })
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

export async function getLastMessageTime(userId: string): Promise<Date | null> {
  const db = getPool()
  const result = await db.query(
    'SELECT created_at FROM ai_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  )
  return result.rows[0]?.created_at ?? null
}

export async function chat(userId: string, message: string): Promise<string> {
  const [persona, history] = await Promise.all([getPersona(userId), getHistory(userId)])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...history.map(({ role, content }) => ({
      role,
      parts: [{ text: content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const tools = [{ functionDeclarations: FUNCTION_DECLARATIONS }]
  const config = { systemInstruction: persona, tools }

  let response = await getAI().models.generateContent({ model: MODEL, contents, config })

  while (response.functionCalls && response.functionCalls.length > 0) {
    const calls = response.functionCalls

    const results = await Promise.all(
      calls.map(async (call) => ({
        name: call.name ?? '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response: await executeFunction(call.name ?? '', (call.args ?? {}) as Record<string, any>),
        id: call.id ?? '',
      }))
    )

    contents.push({ role: 'model', parts: calls.map(fc => ({ functionCall: fc })) })
    contents.push({ role: 'user', parts: results.map(r => ({ functionResponse: r })) })

    response = await getAI().models.generateContent({ model: MODEL, contents, config })
  }

  const reply = response.text?.trim() || '_(no response)_'

  await Promise.all([
    saveMessage(userId, 'user', message),
    saveMessage(userId, 'model', reply),
  ])

  return reply
}
