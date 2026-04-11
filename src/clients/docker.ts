import Docker from 'dockerode'

function getDocker(): Docker {
  return new Docker({ socketPath: '/var/run/docker.sock' })
}

export interface ContainerSummary {
  id: string
  name: string
  status: string
  state: string
  image: string
}

export interface DockerEvent {
  Type: string
  Action: string
  time: number
  id: string
  Actor: {
    Attributes: Record<string, string>
  }
}

async function findContainer(name: string): Promise<Docker.Container> {
  const all = await getDocker().listContainers({ all: true })
  const info = all.find(c => c.Names.some(n => n === `/${name}` || n === name))
  if (!info) throw new Error(`Container not found: ${name}`)
  return getDocker().getContainer(info.Id)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export async function listContainers(all = true): Promise<ContainerSummary[]> {
  const containers = await getDocker().listContainers({ all })
  return containers.map(c => ({
    id: c.Id,
    name: c.Names[0].replace(/^\//, ''),
    status: c.Status,
    state: c.State,
    image: c.Image,
  }))
}

export async function startContainer(name: string): Promise<void> {
  const container = await findContainer(name)
  await container.start()
}

export async function stopContainer(name: string): Promise<void> {
  const container = await findContainer(name)
  await container.stop()
}

export async function restartContainer(name: string): Promise<void> {
  const container = await findContainer(name)
  await container.restart()
}

export async function getContainerLogs(name: string, tail: number): Promise<string> {
  const container = await findContainer(name)
  const buf = await container.logs({ stdout: true, stderr: true, tail }) as unknown as Buffer
  let result = ''
  let offset = 0
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4)
    offset += 8
    result += buf.slice(offset, offset + size).toString('utf8')
    offset += size
  }
  return result.trim() || '(no logs)'
}

export async function getContainerStatus(name: string): Promise<Docker.ContainerInspectInfo> {
  const container = await findContainer(name)
  return container.inspect()
}

export async function getContainerImage(name: string): Promise<string> {
  const container = await findContainer(name)
  const info = await container.inspect()
  return info.Config.Image
}

export async function pullContainerImage(imageName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getDocker().pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err)
      getDocker().modem.followProgress(stream, (err: Error | null) => {
        if (err) return reject(err)
        resolve()
      })
    })
  })
}

export async function getContainerStats(name: string): Promise<{ cpu: string; memory: string }> {
  const container = await findContainer(name)
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(container.stats as any)({ stream: false }, (err: Error | null, data: Docker.ContainerStats) => {
      if (err || !data) return reject(err ?? new Error('No stats data'))
      const cpuDelta = data.cpu_stats.cpu_usage.total_usage - data.precpu_stats.cpu_usage.total_usage
      const sysDelta = data.cpu_stats.system_cpu_usage - data.precpu_stats.system_cpu_usage
      const numCpus = data.cpu_stats.online_cpus ?? 1
      const cpuPercent = sysDelta > 0 ? (cpuDelta / sysDelta) * numCpus * 100 : 0
      const memUsed = data.memory_stats.usage
      const memLimit = data.memory_stats.limit
      resolve({
        cpu: `${cpuPercent.toFixed(2)}%`,
        memory: `${formatBytes(memUsed)} / ${formatBytes(memLimit)}`,
      })
    })
  })
}

export function streamEvents(onEvent: (event: DockerEvent) => void): void {
  getDocker().getEvents({}, (err: Error | null, stream?: NodeJS.ReadableStream) => {
    if (err || !stream) {
      console.error('Failed to connect to Docker event stream:', err)
      return
    }
    stream.on('data', (chunk: Buffer) => {
      try {
        onEvent(JSON.parse(chunk.toString()) as DockerEvent)
      } catch {
        // ignore malformed events
      }
    })
    stream.on('error', (err: Error) => console.error('Docker event stream error:', err))
  })
}
