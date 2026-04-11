import si from 'systeminformation'

export interface SystemStats {
  cpuLoad: number
  memUsedBytes: number
  memTotalBytes: number
  diskUsedBytes: number
  diskTotalBytes: number
  uptimeSeconds: number
}

export async function getSystemStats(): Promise<SystemStats> {
  const [load, mem, disks] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
  ])
  const time = si.time()
  const rootDisk = disks.find(d => d.mount === '/') ?? disks[0]

  return {
    cpuLoad: load.currentLoad,
    memUsedBytes: mem.used,
    memTotalBytes: mem.total,
    diskUsedBytes: rootDisk?.used ?? 0,
    diskTotalBytes: rootDisk?.size ?? 0,
    uptimeSeconds: time.uptime,
  }
}
