import type { FunctionDeclaration } from '@google/genai'

export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
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
  {
    name: 'web_search',
    description: 'Search the web for current information. Use for PoE patch notes, current league meta, poe.ninja data, recent news, or anything that may have changed recently.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_note',
    description: 'Save a quick note or todo item for FuuFu.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The note or todo content' },
      },
      required: ['content'],
    },
  },
  {
    name: 'list_notes',
    description: "List FuuFu's saved notes and todos.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: "Which notes to return: 'pending' (default), 'done', or 'all'" },
      },
    },
  },
  {
    name: 'complete_note',
    description: 'Mark a note or todo as done by partial text match.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        match: { type: 'string', description: 'Partial text of the note to mark as done' },
      },
      required: ['match'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note or todo by partial text match.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        match: { type: 'string', description: 'Partial text of the note to delete' },
      },
      required: ['match'],
    },
  },
  {
    name: 'remember_note',
    description: 'Save or update a persistent fact about FuuFu to remember across future conversations. Use this proactively whenever FuuFu shares a preference, habit, goal, routine, or any personal detail worth remembering.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: "Short snake_case identifier, e.g. 'workout_schedule', 'dietary_goal', 'sleep_target'" },
        value: { type: 'string', description: 'The fact to remember, written as a complete sentence' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'forget_note',
    description: 'Delete a saved note that is no longer accurate or relevant.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The key of the note to delete' },
      },
      required: ['key'],
    },
  },
  {
    name: 'trigger_n8n_workflow',
    description: "Trigger a registered n8n automation workflow by name. Always call list_n8n_workflows first to discover available workflows and their required payloads. CRITICAL: construct the payload using ONLY the exact field names listed in the workflow's payload_schema.fields array — do NOT rename, abbreviate, translate, or substitute them. For example if the schema says \"dateTime\", send \"dateTime\" — not \"date\", \"due_date\", \"datetime\", \"start_time\", or any other variation. IMPORTANT: always resolve relative dates (\"tomorrow\", \"next Monday\", \"in 2 hours\") to absolute ISO 8601 strings in WIB (UTC+7) before passing them in the payload — never pass natural language date strings. After triggering, tell FuuFu you have submitted the request and that he will be notified of the result. Do NOT claim the workflow succeeded or failed — the outcome arrives via a separate callback.",
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name as returned by list_n8n_workflows' },
        payload: { type: 'object', description: 'Data to pass to the workflow' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_bookmark',
    description: 'Save a new media bookmark for FuuFu. Required: name, type (manhwa/manga/manhua/anime/novel), status (reading/watching/completed/dropped/on_hold/plan_to_start), progress (e.g. "Ch. 100", "Ep. 12"). Optional: notes. Always gather all required fields conversationally before calling — never call with missing required fields. After calling, do NOT send a confirmation message — the system will notify FuuFu automatically.',
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
    description: 'Update an existing bookmark for FuuFu. Requires the exact name. At least one of progress, status, or notes must be provided. After calling, do NOT send a confirmation message — the system will notify FuuFu automatically.',
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
    description: 'Delete a bookmark permanently. Always confirm with FuuFu before calling this. After calling, do NOT send a confirmation message — the system will notify FuuFu automatically.',
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
]
