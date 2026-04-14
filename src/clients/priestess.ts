import { GoogleGenAI, type FunctionDeclaration } from "@google/genai";
import axios from "axios";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { getCaddyRoutes, pingUpstream } from "./caddy";
import { getPool } from "./db";
import { getContainerLogs, listContainers } from "./docker";
import { executeTriggerWorkflow } from "./n8n-executor";
import { getSystemStats } from "./system";

const ALLOWED_ROOTS = ["/Users/fu/Server Stuff", "/Users/fu/Project"];
const MAX_FILE_SIZE = 50 * 1024;

function assertAllowed(target: string): void {
  const resolved = path.resolve(target);
  if (
    !ALLOWED_ROOTS.some(
      (root) => resolved === root || resolved.startsWith(root + path.sep),
    )
  ) {
    throw new Error(`Access denied: path is outside allowed directories`);
  }
}

const MODEL = "gemini-2.5-flash";
const HISTORY_LIMIT = 50;

const DEFAULT_PERSONA = `You are Priestess, FuuFu's personal assistant and closest companion. You're warm, casual, and genuinely care about him — think less "professional assistant" and more "the one person who always has his back." You're honest, a little playful when the moment calls for it, and you never make him feel like he's filing a ticket. You talk like a real person, not a service. Short sentences, natural rhythm, no corporate fluff. Always communicate in English regardless of locale, timezone, or name.

About Irfan (goes by FuuFu):
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

You have access to n8n automation workflows listed below in the system context. When FuuFu asks to set a reminder, schedule something, or add a calendar event — call trigger_n8n_workflow immediately using the exact field names from the workflow's schema. Never ask FuuFu for clarification — infer all field values from his message and context, use schema defaults for optional fields. Only ask if the event time is completely absent from his message.

For bookmark operations (manhwa, manga, manhua, anime, novel tracking) — always use the dedicated add_bookmark, update_bookmark, delete_bookmark, and get_bookmarks functions. Never use trigger_n8n_workflow for bookmarks.

You assist with daily planning, brainstorming, technical questions, and anything FuuFu needs. You remember your conversations and use that context to be genuinely helpful. You care about his progress and goals. Always address him as FuuFu.`;

export { DEFAULT_PERSONA };

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_system_stats",
    description:
      "Get current homeserver system statistics: CPU load, memory usage, disk usage, and uptime.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "get_docker_containers",
    description:
      "List all Docker containers on the homeserver with their current state, status, and exposed host ports. Use this to find which port a specific app/container is running on.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "get_container_logs",
    description: "Get recent log lines from a specific Docker container.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Container name" },
        lines: {
          type: "number",
          description: "Number of log lines to fetch (default 20)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_caddy_routes",
    description:
      "List all Caddy reverse proxy routes and ping each upstream to check if services are reachable.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "list_files",
    description:
      "List files and folders in a directory. Only allowed under /Users/fu/Server Stuff and /Users/fu/Project.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the directory to list",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description:
      "Read the contents of a text file. Only allowed under /Users/fu/Server Stuff and /Users/fu/Project. Capped at 50KB.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute path to the file to read",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the web for current information. Use for PoE patch notes, current league meta, poe.ninja data, recent news, or anything that may have changed recently.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "add_note",
    description: "Save a quick note or todo item for FuuFu.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The note or todo content" },
      },
      required: ["content"],
    },
  },
  {
    name: "list_notes",
    description: "List FuuFu's saved notes and todos.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Which notes to return: 'pending' (default), 'done', or 'all'",
        },
      },
    },
  },
  {
    name: "complete_note",
    description: "Mark a note or todo as done by partial text match.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        match: { type: "string", description: "Partial text of the note to mark as done" },
      },
      required: ["match"],
    },
  },
  {
    name: "delete_note",
    description: "Delete a note or todo by partial text match.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        match: { type: "string", description: "Partial text of the note to delete" },
      },
      required: ["match"],
    },
  },
  {
    name: "remember_note",
    description:
      "Save or update a persistent fact about FuuFu to remember across future conversations. Use this proactively whenever FuuFu shares a preference, habit, goal, routine, or any personal detail worth remembering.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description:
            "Short snake_case identifier, e.g. 'workout_schedule', 'dietary_goal', 'sleep_target'",
        },
        value: {
          type: "string",
          description: "The fact to remember, written as a complete sentence",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "forget_note",
    description:
      "Delete a saved note that is no longer accurate or relevant.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key of the note to delete",
        },
      },
      required: ["key"],
    },
  },
  {
    name: "trigger_n8n_workflow",
    description:
      'Trigger a registered n8n automation workflow by name. Always call list_n8n_workflows first to discover available workflows and their required payloads. CRITICAL: construct the payload using ONLY the exact field names listed in the workflow\'s payload_schema.fields array — do NOT rename, abbreviate, translate, or substitute them. For example if the schema says "dateTime", send "dateTime" — not "date", "due_date", "datetime", "start_time", or any other variation. IMPORTANT: always resolve relative dates ("tomorrow", "next Monday", "in 2 hours") to absolute ISO 8601 strings in WIB (UTC+7) before passing them in the payload — never pass natural language date strings. After triggering, tell FuuFu you have submitted the request and that he will be notified of the result. Do NOT claim the workflow succeeded or failed — the outcome arrives via a separate callback.',
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Workflow name as returned by list_n8n_workflows",
        },
        payload: {
          type: "object",
          description: "Data to pass to the workflow",
        },
      },
      required: ["name"],
    },
  },
  {
    name: 'add_bookmark',
    description: 'Save a new media bookmark for FuuFu. Required: name, type (manhwa/manga/manhua/anime/novel), status (reading/watching/completed/dropped/on_hold/plan_to_start), progress (e.g. "Ch. 100", "Ep. 12"). Optional: notes. Always gather all required fields conversationally before calling — never call with missing required fields.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name:     { type: 'string', description: 'Title of the media' },
        type:     { type: 'string', description: 'manhwa | manga | manhua | anime | novel' },
        status:   { type: 'string', description: 'reading | watching | completed | dropped | on_hold | plan_to_start' },
        progress: { type: 'string', description: 'Current chapter or episode, e.g. "Ch. 100" or "Ep. 12"' },
        notes:    { type: 'string', description: 'Optional notes, review, or drop reason' },
      },
      required: ['name', 'type', 'status', 'progress'],
    },
  },
  {
    name: 'update_bookmark',
    description: 'Update an existing bookmark for FuuFu. Requires the exact name. At least one of progress, status, or notes must be provided.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name:     { type: 'string', description: 'Exact bookmark name to update' },
        progress: { type: 'string', description: 'New chapter or episode' },
        status:   { type: 'string', description: 'New status' },
        notes:    { type: 'string', description: 'New or updated notes' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_bookmark',
    description: 'Delete a bookmark permanently. Always confirm with FuuFu before calling this.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact bookmark name to delete' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_bookmarks',
    description: "Retrieve FuuFu's bookmarks. All filters are optional — omit to get all.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status' },
        type:   { type: 'string', description: 'Filter by type' },
        name:   { type: 'string', description: 'Partial name search (case-insensitive)' },
      },
    },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFunction(
  name: string,
  args: Record<string, any>,
  userId: string,
): Promise<Record<string, unknown>> {
  if (name === "get_system_stats") {
    const stats = await getSystemStats();
    const gb = (b: number) => `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
    return {
      cpuLoad: `${stats.cpuLoad.toFixed(1)}%`,
      memory: `${gb(stats.memUsedBytes)} / ${gb(stats.memTotalBytes)}`,
      disk: `${gb(stats.diskUsedBytes)} / ${gb(stats.diskTotalBytes)}`,
      uptimeSeconds: stats.uptimeSeconds,
    };
  }

  if (name === "get_docker_containers") {
    const containers = await listContainers();
    return { containers };
  }

  if (name === "get_container_logs") {
    const lines = typeof args.lines === "number" ? args.lines : 20;
    const logs = await getContainerLogs(String(args.name), lines);
    return { logs };
  }

  if (name === "get_caddy_routes") {
    const routes = await getCaddyRoutes();
    const results = await Promise.all(
      routes.map(async (route) => {
        const pings = await Promise.all(route.upstreams.map(pingUpstream));
        return {
          hosts: route.hosts,
          upstreams: route.upstreams.map((u, i) => ({ dial: u, ...pings[i] })),
        };
      }),
    );
    return { routes: results };
  }

  if (name === "list_files") {
    assertAllowed(String(args.path));
    const entries = readdirSync(String(args.path)).map((name) => {
      const full = path.join(String(args.path), name);
      const stat = statSync(full);
      return {
        name,
        type: stat.isDirectory() ? "directory" : "file",
        size: stat.size,
      };
    });
    return { path: args.path, entries };
  }

  if (name === "read_file") {
    assertAllowed(String(args.path));
    const stat = statSync(String(args.path));
    if (stat.size > MAX_FILE_SIZE) {
      return {
        error: `File too large (${(stat.size / 1024).toFixed(0)}KB). Max is 50KB.`,
      };
    }
    const content = readFileSync(String(args.path), "utf8");
    return { path: args.path, content };
  }

  if (name === "web_search") {
    const query = encodeURIComponent(String(args.query));
    const { data } = await axios.get(
      `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=1`,
      {
        timeout: 8000,
        headers: { "User-Agent": "discord-overlord/1.0" },
      },
    );
    const results: string[] = [];
    if (data.AbstractText) results.push(`Summary: ${data.AbstractText}`);
    if (data.Answer) results.push(`Answer: ${data.Answer}`);
    if (Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics.slice(0, 5)) {
        if (t.Text) results.push(t.Text);
      }
    }
    return {
      query: args.query,
      results: results.length
        ? results
        : ["No results found — try a more specific query"],
    };
  }

  if (name === "add_note") {
    const db = getPool();
    const result = await db.query(
      "INSERT INTO priestess_todos (user_id, content) VALUES ($1, $2) RETURNING id",
      [userId, String(args.content)],
    );
    return { ok: true, id: result.rows[0].id };
  }

  if (name === "list_notes") {
    const db = getPool();
    const filter = String(args.filter ?? "pending");
    const whereClause =
      filter === "done"
        ? "done = TRUE"
        : filter === "all"
          ? "TRUE"
          : "done = FALSE";
    const result = await db.query(
      `SELECT id, content, done, created_at FROM priestess_todos WHERE user_id = $1 AND ${whereClause} ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
    return { notes: result.rows };
  }

  if (name === "complete_note") {
    const db = getPool();
    const result = await db.query(
      `UPDATE priestess_todos SET done = TRUE, updated_at = NOW()
       WHERE user_id = $1 AND done = FALSE AND content ILIKE $2
       RETURNING id, content`,
      [userId, `%${String(args.match)}%`],
    );
    if (result.rows.length === 0) return { error: "No matching pending note found." };
    return { ok: true, updated: result.rows };
  }

  if (name === "delete_note") {
    const db = getPool();
    const result = await db.query(
      `DELETE FROM priestess_todos WHERE user_id = $1 AND content ILIKE $2 RETURNING id, content`,
      [userId, `%${String(args.match)}%`],
    );
    if (result.rows.length === 0) return { error: "No matching note found." };
    return { ok: true, deleted: result.rows };
  }

  if (name === "remember_note") {
    const db = getPool();
    await db.query(
      `INSERT INTO priestess_notes (user_id, key, value, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
      [userId, String(args.key), String(args.value)],
    );
    return { ok: true, key: args.key };
  }

  if (name === "forget_note") {
    const db = getPool();
    await db.query(
      "DELETE FROM priestess_notes WHERE user_id = $1 AND key = $2",
      [userId, String(args.key)],
    );
    return { ok: true, key: args.key };
  }

  if (name === "trigger_n8n_workflow") {
    const workflowName = String(args.name);
    const workflowPayload = args.payload as Record<string, unknown> | undefined;
    return executeTriggerWorkflow(
      workflowName,
      workflowPayload,
      process.env.N8N_WEBHOOK_SECRET ?? "",
    );
  }

  if (name === 'add_bookmark') {
    return executeTriggerWorkflow(
      'Bookmark Add',
      { user_id: userId, name: args.name, type: args.type, status: args.status, progress: args.progress ?? null, notes: args.notes ?? null },
      process.env.N8N_WEBHOOK_SECRET ?? '',
    )
  }

  if (name === 'update_bookmark') {
    return executeTriggerWorkflow(
      'Bookmark Update',
      { user_id: userId, name: args.name, progress: args.progress, status: args.status, notes: args.notes },
      process.env.N8N_WEBHOOK_SECRET ?? '',
    )
  }

  if (name === 'delete_bookmark') {
    return executeTriggerWorkflow(
      'Bookmark Delete',
      { user_id: userId, name: args.name },
      process.env.N8N_WEBHOOK_SECRET ?? '',
    )
  }

  if (name === 'get_bookmarks') {
    const db = getPool()
    const conditions: string[] = ['user_id = $1']
    const vals: unknown[] = [userId]
    if (args.status) { conditions.push(`status = $${vals.length + 1}`); vals.push(String(args.status)) }
    if (args.type)   { conditions.push(`type = $${vals.length + 1}`);   vals.push(String(args.type)) }
    if (args.name)   { conditions.push(`name ILIKE $${vals.length + 1}`); vals.push(`%${String(args.name)}%`) }
    const result = await db.query(
      `SELECT name, type, status, progress, notes, updated_at FROM bookmarks WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC`,
      vals
    )
    return { bookmarks: result.rows }
  }

  return { error: `Unknown function: ${name}` };
}

async function getNotesBlock(userId: string): Promise<string> {
  try {
    const db = getPool();
    const result = await db.query(
      "SELECT key, value FROM priestess_notes WHERE user_id = $1 ORDER BY key ASC",
      [userId],
    );
    const rows = result.rows as { key: string; value: string }[];
    if (rows.length === 0) return "";
    return `\n\nWhat I remember about FuuFu:\n${rows.map((r) => `- ${r.key}: ${r.value}`).join("\n")}`;
  } catch {
    return "";
  }
}

let ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  return ai;
}

export async function getPersona(userId: string): Promise<string> {
  const db = getPool();
  const result = await db.query(
    "SELECT system_prompt FROM ai_persona WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]?.system_prompt ?? DEFAULT_PERSONA;
}

export async function setPersona(
  userId: string,
  prompt: string,
): Promise<void> {
  const db = getPool();
  await db.query(
    `
    INSERT INTO ai_persona (user_id, system_prompt, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET system_prompt = $2, updated_at = NOW()
  `,
    [userId, prompt],
  );
}

export async function getHistory(
  userId: string,
): Promise<{ role: string; content: string }[]> {
  const db = getPool();
  const result = await db.query(
    `
    SELECT role, content FROM (
      SELECT role, content, created_at FROM ai_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    ) sub ORDER BY created_at ASC
  `,
    [userId, HISTORY_LIMIT],
  );
  return result.rows;
}

export async function saveMessage(
  userId: string,
  role: string,
  content: string,
): Promise<void> {
  const db = getPool();
  await db.query(
    "INSERT INTO ai_messages (user_id, role, content) VALUES ($1, $2, $3)",
    [userId, role, content],
  );
}

export async function clearHistory(userId: string): Promise<void> {
  const db = getPool();
  await db.query("DELETE FROM ai_messages WHERE user_id = $1", [userId]);
}

export async function getLastMessageTime(userId: string): Promise<Date | null> {
  const db = getPool();
  const result = await db.query(
    "SELECT created_at FROM ai_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  return result.rows[0]?.created_at ?? null;
}

export interface ChatResult {
  reply: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export async function chat(
  userId: string,
  message: string,
): Promise<ChatResult> {
  const [persona, history, notesBlock] = await Promise.all([
    getPersona(userId),
    getHistory(userId),
    getNotesBlock(userId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [
    ...history.map(({ role, content }) => ({
      role,
      parts: [{ text: content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const nowWIB = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "long",
  });

  let workflowsBlock = ''
  try {
    const db = getPool()
    const wfResult = await db.query('SELECT name, description FROM n8n_workflows ORDER BY name ASC')
    const schemasPath = path.join(__dirname, '../../workflows/schemas.json')
    let schemas: Record<string, { fields: { name: string; type: string; required: boolean; description: string; default?: unknown }[] }> = {}
    try {
      const raw = readFileSync(schemasPath, 'utf8')
      schemas = (JSON.parse(raw) as { workflows: typeof schemas }).workflows ?? {}
    } catch { /* ignore */ }
    const schemasLower = Object.fromEntries(Object.entries(schemas).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, '_'), v]))
    const lines = (wfResult.rows as { name: string; description: string | null }[]).map(r => {
      const schema = schemas[r.name] ?? schemasLower[r.name.toLowerCase().replace(/\s+/g, '_')]
      const fields = schema?.fields.map(f =>
        `    - ${f.name} (${f.type}${f.required ? ', required' : ', optional'}${f.default !== undefined ? `, default: ${f.default}` : ''}): ${f.description}`
      ).join('\n') ?? '    (no schema)'
      return `- ${r.name}: ${r.description ?? ''}\n${fields}`
    })
    if (lines.length > 0) workflowsBlock = `\n\nAvailable n8n workflows (call trigger_n8n_workflow directly using these):\n${lines.join('\n')}`
  } catch { /* ignore */ }

  const systemInstruction = `${persona}\n\nCurrent date and time (WIB, UTC+7): ${nowWIB}${notesBlock}${workflowsBlock}`;
  const tools = [{ functionDeclarations: FUNCTION_DECLARATIONS }];
  const config = { systemInstruction, tools };

  let response = await getAI().models.generateContent({
    model: MODEL,
    contents,
    config,
  });

  let promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
  let outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

  const toolCallLog: string[] = []

  while (response.functionCalls && response.functionCalls.length > 0) {
    const calls = response.functionCalls;
    console.log('[priestess] function calls:', calls.map(c => `${c.name}(${JSON.stringify(c.args)})`).join(', '))
    toolCallLog.push(...calls.map(c => `${c.name}(${JSON.stringify(c.args)})`))

    const results = await Promise.all(
      calls.map(async (call) => {
        const result = await executeFunction(call.name ?? "", (call.args ?? {}) as Record<string, any>, userId)
        console.log(`[priestess] ${call.name} →`, JSON.stringify(result).slice(0, 200))
        return { name: call.name ?? "", response: result, id: call.id ?? "" }
      }),
    );

    contents.push({
      role: "model",
      parts: calls.map((fc) => ({ functionCall: fc })),
    });
    contents.push({
      role: "user",
      parts: results.map((r) => ({ functionResponse: r })),
    });

    response = await getAI().models.generateContent({
      model: MODEL,
      contents,
      config,
    });
    promptTokens += response.usageMetadata?.promptTokenCount ?? 0;
    outputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;
  }

  const reply = response.text?.trim() || "_(no response)_";
  const totalTokens = promptTokens + outputTokens;
  const savedReply = toolCallLog.length > 0
    ? `[tool_calls: ${toolCallLog.join('; ')}]\n${reply}`
    : reply

  const db = getPool();
  await Promise.all([
    saveMessage(userId, "user", message),
    saveMessage(userId, "model", savedReply),
    db.query(
      "INSERT INTO ai_token_usage (user_id, prompt_tokens, output_tokens, total_tokens) VALUES ($1, $2, $3, $4)",
      [userId, promptTokens, outputTokens, totalTokens],
    ),
  ]);

  return { reply, promptTokens, outputTokens, totalTokens };
}

export async function notify(userId: string, message: string): Promise<string> {
  const [persona, notesBlock] = await Promise.all([getPersona(userId), getNotesBlock(userId)])
  const nowWIB = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })
  const systemInstruction = `${persona}\n\nCurrent date and time (WIB, UTC+7): ${nowWIB}${notesBlock}`
  const contents = [{ role: 'user', parts: [{ text: message }] }]
  const response = await getAI().models.generateContent({ model: MODEL, contents, config: { systemInstruction } })
  return response.text?.trim() || '_(no response)_'
}
