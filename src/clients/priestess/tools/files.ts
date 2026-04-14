import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const ALLOWED_ROOTS = ['/Users/fu/Server Stuff', '/Users/fu/Project']
const MAX_FILE_SIZE = 50 * 1024

export function assertAllowed(target: string): void {
  const resolved = path.resolve(target)
  if (!ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(root + path.sep))) {
    throw new Error('Access denied: path is outside allowed directories')
  }
}

export function handleListFiles(args: Record<string, unknown>): Record<string, unknown> {
  assertAllowed(String(args.path))
  const entries = readdirSync(String(args.path)).map(name => {
    const full = path.join(String(args.path), name)
    const stat = statSync(full)
    return { name, type: stat.isDirectory() ? 'directory' : 'file', size: stat.size }
  })
  return { path: args.path, entries }
}

export function handleReadFile(args: Record<string, unknown>): Record<string, unknown> {
  assertAllowed(String(args.path))
  const stat = statSync(String(args.path))
  if (stat.size > MAX_FILE_SIZE) {
    return { error: `File too large (${(stat.size / 1024).toFixed(0)}KB). Max is 50KB.` }
  }
  const content = readFileSync(String(args.path), 'utf8')
  return { path: args.path, content }
}
