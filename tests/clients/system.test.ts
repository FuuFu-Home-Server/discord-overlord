import si from 'systeminformation'
import { getSystemStats } from '../../src/clients/system'

jest.mock('systeminformation')
const mockedSi = si as jest.Mocked<typeof si>

describe('getSystemStats', () => {
  it('returns formatted system stats', async () => {
    mockedSi.currentLoad.mockResolvedValue({ currentLoad: 42.5 } as si.Systeminformation.CurrentLoadData)
    mockedSi.mem.mockResolvedValue({ used: 4294967296, total: 8589934592 } as si.Systeminformation.MemData)
    mockedSi.fsSize.mockResolvedValue([{ used: 107374182400, size: 536870912000, mount: '/' }] as si.Systeminformation.FsSizeData[])
    mockedSi.time.mockReturnValue({ uptime: 86400 } as si.Systeminformation.TimeData)

    const stats = await getSystemStats()

    expect(stats.cpuLoad).toBeCloseTo(42.5)
    expect(stats.memUsedBytes).toBe(4294967296)
    expect(stats.memTotalBytes).toBe(8589934592)
    expect(stats.diskUsedBytes).toBe(107374182400)
    expect(stats.diskTotalBytes).toBe(536870912000)
    expect(stats.uptimeSeconds).toBe(86400)
  })
})
