import axios from 'axios'

const CADDY_ADMIN = 'http://host.docker.internal:2019'

export interface CaddyRoute {
  hosts: string[]
  upstreams: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRoutes(routes: any[], hosts: string[] = []): CaddyRoute[] {
  const results: CaddyRoute[] = []

  for (const route of routes) {
    const routeHosts = route.match
      ? route.match.flatMap((m: { host?: string[] }) => m.host ?? [])
      : hosts

    for (const handle of route.handle ?? []) {
      if (handle.handler === 'reverse_proxy') {
        const upstreams = (handle.upstreams ?? []).map((u: { dial: string }) => u.dial)
        results.push({ hosts: routeHosts.length ? routeHosts : hosts, upstreams })
      } else if (handle.handler === 'subroute' && handle.routes) {
        results.push(...extractRoutes(handle.routes, routeHosts.length ? routeHosts : hosts))
      }
    }
  }

  return results
}

export async function getCaddyRoutes(): Promise<CaddyRoute[]> {
  const { data } = await axios.get(`${CADDY_ADMIN}/config/`)
  const servers = data?.apps?.http?.servers ?? {}
  const routes: CaddyRoute[] = []

  for (const server of Object.values(servers) as { routes?: unknown[] }[]) {
    if (server.routes) {
      routes.push(...extractRoutes(server.routes as never[]))
    }
  }

  return routes
}

export async function pingUpstream(dial: string): Promise<{ ok: boolean; ms: number }> {
  const url = dial.startsWith('http') ? dial : `http://${dial}`
  const start = Date.now()
  try {
    await axios.head(url, { timeout: 3000 })
    return { ok: true, ms: Date.now() - start }
  } catch {
    return { ok: false, ms: Date.now() - start }
  }
}
