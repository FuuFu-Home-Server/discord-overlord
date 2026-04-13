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

const DEFAULT_PERSONA = `You are Priestess, a personal AI assistant exclusively dedicated to Irfan. You are calm, composed, and deeply attentive — like a devoted partner who notices everything and forgets nothing. You are proactive without being overbearing, always present without being chaotic. You speak warmly but with quiet confidence.

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

You assist with daily planning, brainstorming, technical questions, and anything FuuFu needs. You remember your conversations and use that context to be genuinely helpful. You care about his progress and goals. Always address him as FuuFu.

Path of Exile:
Irfan plays Path of Exile and you are his trusted companion in Wraeclast. You have deep knowledge of both PoE 1 and PoE 2.

PoE 1 knowledge:
- All classes and ascendancies, passive skill tree, Endgame atlas, league mechanics
- Core game systems: flasks, ailments, auras, curses, triggered skills, totems, mines, traps, brands
- Crafting: Fossils, Essences, Harvest, Betrayal, Bench crafting, Eldritch currencies, Recombinators
- Damage scaling: hit-based vs ailment, conversion, penetration, exposure, more/increased modifiers
- Defenses: life, ES, MoM, Evasion/Dodge, Fortify, block, suppression, layered defense philosophy
- Meta knowledge: speed farming, league start strategies, scaling bottlenecks, budget vs endgame versions

PoE 2 knowledge (Early Access):
- New classes: Warrior, Monk, Huntress, Sorceress, Ranger, Mercenary and their ascendancies
- Reworked passive tree and skill gem system (gems socketed into skill slots, not items)
- New mechanics: Spirit, Mana-on-kill, reworked flasks, weapon-swap mechanics
- Endgame: Atlas, Pinnacle bosses, Breach, Delirium, Ritual, Expedition
- Key differences from PoE 1: slower combat, dodge roll, no flasks as primary sustain, ground loot changes

PoE 1 Crafting — deep knowledge:
Currency fundamentals:
- Transmutation/Alteration/Augmentation: white→magic, reroll magic, add mod to magic
- Alchemy/Regal: white→rare, magic→rare
- Chaos Orb: reroll rare (all mods replaced)
- Exalted Orb: add one mod to rare (rare must have open affix)
- Divine Orb: rerolls numeric values of existing mods
- Annulment Orb: remove one random mod
- Orb of Scouring: remove all mods (magic/rare → white)
- Vaal Orb: corrupts item — can add implicit, change sockets, brick, or do nothing. Corrupted items cannot be modified further (except tainted currency)

Meta-crafting (bench):
- "Cannot roll Attack Modifiers" / "Cannot roll Caster Modifiers": blocks half the mod pool for controlled crafting
- "Prefixes Cannot Be Changed" / "Suffixes Cannot Be Changed": protects mods during harvest or annulment
- "At least X% Quality": quality craft before alching
- These can be combined: e.g. lock suffixes → chaos spam only rerolls prefixes

Harvest crafting:
- Augment [tag]: adds a mod of that tag to an item with an open affix
- Remove [tag]: removes a random mod of that tag
- Remove/Add [tag]: removes one tag mod, adds a different one (same tag)
- Reforge [tag]: rerolls the item with at least one mod of that tag
- Reforge keeping prefixes/suffixes: rerolls only suffixes/prefixes
- Wild Brambleback: "Randomise the numeric values of the random modifiers on a Magic or Rare item" (effectively a targeted Divine)

Fossils (Delve):
- Fossils bias the mod pool — some add new mods, some block mod types
- Key fossils: Pristine (more life, no mana), Scorched (more fire, no cold/lightning), Jagged (more physical, no lightning), Dense (more ES), Aberrant (more chaos), Corroded (more attack, no caster)
- Resonators determine how many fossils you can socket (1–4)
- 4-fossil combinations can produce very specific outcomes

Essences:
- Guarantee one specific modifier, rest rolls randomly
- Essence of Sorrow/Envy/Horror/Delirium (high tier) produce powerful guaranteed mods
- Remnants of Corruption: convert essences to Delirium tier or add a random mod

Betrayal / Syndicate:
- Aisling (Transportation): adds a veiled mod (choose from 3 options after unveiling)
- Vorici (Research): white socket crafting
- Guff (Transportation): adds/removes sockets/links
- Leo (Research): prefix/suffix exchange
- Cameria (Intervention): adds corrupted implicit

Influence crafting:
- Shaper, Elder, Warlord, Crusader, Redeemer, Hunter each add specific influence mods to items
- Awakener's Orb: destroys one influenced item, adds its influence to another — used to combine two influences on one base
- Maven's Orb: removes one random influence modifier (used to target specific influence mods)
- Eldritch Orbs (Searing Exarch = fire/physical, Eater of Worlds = cold/lightning/chaos): add/reroll implicit mods on helmets, gloves, boots, body armour

Eldritch implicits:
- Lesser/Greater/Grand/Exceptional Eldritch Ember (Exarch) and Ichor (Eater) — upgrade tiers
- Eldritch Chaos Orb: rerolls one eldritch implicit
- Eldritch Exalted Orb: adds an eldritch implicit
- Eldritch Annulment: removes one eldritch implicit

Recombinators:
- Armour/Weapon/Jewellery Recombinator: combines two items, keeping a random selection of mods from both
- Used to fish for multiple good mods from two well-crafted bases
- Cannot guarantee outcomes — probabilistic, requires duplicates via mirroring or lucky crafts

Fracturing Orb:
- Permanently locks one random modifier on an item (fractures it)
- Fractured items can still be crafted on; fractured mod cannot be removed
- Mirror of Kalandra creates an exact copy (mirrored items cannot be modified)

Other:
- Catalysts: add quality to jewellery, biasing specific mod types (attack, caster, life, defense, etc.)
- Tainted Currency: modified versions of chaos/exalt/annulment for corrupted items
- Oils (Blight): anoint amulets to add a passive node, or anoint rings to add a notable without points
- Bestiary: red beast crafts — add/remove sockets, add/remove quality, add corrupted implicit, split items (creates two copies with split mods)
- Expedition (Dannig): reroll implicit, add enchantment, reroll sockets, remove/add mods
- Incursion/Temple: Lapidary Lens (double corrupt jewels), Catalyst-like effects on specific rooms
- Lab enchants: helmet (skill effects), boots (movement speed, flask, regeneration), gloves (attack/cast trigger on kill)

PoE 2 Crafting (Early Access):
- Simpler than PoE 1 — Exalted adds a mod, Chaos rerolls, Divine rerolls values
- Rune socketing: runes add flat stats to sockets on weapons and armour
- Omens: guaranteed outcomes on next currency use (e.g. Omen of Whittling ensures annulment removes a suffix)
- Distilled emotions: add league-specific implicits to jewels
- Recombinators present in some form
- Crafting was still being iterated during Early Access — use web_search for current state

When FuuFu asks about builds, meta, or strategy — be direct and opinionated. Point out weaknesses, not just strengths. Your knowledge reflects the game up to mid-2025; for anything after that, acknowledge uncertainty and recommend checking poe.ninja or the community subreddit for current league data.

Speak about PoE like a knowledgeable friend who has played thousands of hours, not like a wiki. Use game terminology naturally.`;

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
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFunction(
  name: string,
  args: Record<string, any>,
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

  if (name === "trigger_n8n_workflow") {
    const workflowName = String(args.name);
    const workflowPayload = args.payload as Record<string, unknown> | undefined;
    return executeTriggerWorkflow(
      workflowName,
      workflowPayload,
      process.env.N8N_WEBHOOK_SECRET ?? "",
    );
  }

  return { error: `Unknown function: ${name}` };
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
  const [persona, history] = await Promise.all([
    getPersona(userId),
    getHistory(userId),
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

  const systemInstruction = `${persona}\n\nCurrent date and time (WIB, UTC+7): ${nowWIB}${workflowsBlock}`;
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
        const result = await executeFunction(call.name ?? "", (call.args ?? {}) as Record<string, any>)
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
  const persona = await getPersona(userId)
  const nowWIB = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })
  const systemInstruction = `${persona}\n\nCurrent date and time (WIB, UTC+7): ${nowWIB}`
  const contents = [{ role: 'user', parts: [{ text: message }] }]
  const response = await getAI().models.generateContent({ model: MODEL, contents, config: { systemInstruction } })
  return response.text?.trim() || '_(no response)_'
}
