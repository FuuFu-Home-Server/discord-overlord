import { getCaddyRoutes, pingUpstream } from '@/clients/caddy'
import { getContainerLogs, listContainers } from '@/clients/docker'
import { getSystemStats } from '@/clients/system'

export async function handleGetSystemStats(): Promise<Record<string, unknown>> {
  const stats = await getSystemStats()
  const gb = (b: number) => `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
  return {
    cpuLoad: `${stats.cpuLoad.toFixed(1)}%`,
    memory: `${gb(stats.memUsedBytes)} / ${gb(stats.memTotalBytes)}`,
    disk: `${gb(stats.diskUsedBytes)} / ${gb(stats.diskTotalBytes)}`,
    uptimeSeconds: stats.uptimeSeconds,
  }
}

export async function handleGetDockerContainers(): Promise<Record<string, unknown>> {
  const containers = await listContainers()
  return { containers }
}

export async function handleGetContainerLogs(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const lines = typeof args.lines === 'number' ? args.lines : 20
  const logs = await getContainerLogs(String(args.name), lines)
  return { logs }
}

export async function handleGetCaddyRoutes(): Promise<Record<string, unknown>> {
  const routes = await getCaddyRoutes()
  const results = await Promise.all(
    routes.map(async (route) => {
      const pings = await Promise.all(route.upstreams.map(pingUpstream))
      return {
        hosts: route.hosts,
        upstreams: route.upstreams.map((u, i) => ({ dial: u, ...pings[i] })),
      }
    }),
  )
  return { routes: results }
}
