import { handleGetCaddyRoutes, handleGetContainerLogs, handleGetDockerContainers, handleGetSystemStats } from './system'
import { handleListFiles, handleReadFile } from './files'
import { handleWebSearch } from './search'
import { handleAddNote, handleCompleteNote, handleDeleteNote, handleForgetNote, handleListNotes, handleRememberNote } from './notes'
import { handleAddBookmark, handleDeleteBookmark, handleGetBookmarks, handleUpdateBookmark } from './bookmarks'
import { handleTriggerN8nWorkflow } from './n8n'

export async function executeFunction(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>,
  userId: string,
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'get_system_stats':      return handleGetSystemStats()
    case 'get_docker_containers': return handleGetDockerContainers()
    case 'get_container_logs':    return handleGetContainerLogs(args)
    case 'get_caddy_routes':      return handleGetCaddyRoutes()
    case 'list_files':            return handleListFiles(args)
    case 'read_file':             return handleReadFile(args)
    case 'web_search':            return handleWebSearch(args)
    case 'add_note':              return handleAddNote(args, userId)
    case 'list_notes':            return handleListNotes(args, userId)
    case 'complete_note':         return handleCompleteNote(args, userId)
    case 'delete_note':           return handleDeleteNote(args, userId)
    case 'remember_note':         return handleRememberNote(args, userId)
    case 'forget_note':           return handleForgetNote(args, userId)
    case 'add_bookmark':          return handleAddBookmark(args, userId)
    case 'update_bookmark':       return handleUpdateBookmark(args, userId)
    case 'delete_bookmark':       return handleDeleteBookmark(args, userId)
    case 'get_bookmarks':         return handleGetBookmarks(args, userId)
    case 'trigger_n8n_workflow':  return handleTriggerN8nWorkflow(args)
    default:                      return { error: `Unknown function: ${name}` }
  }
}
