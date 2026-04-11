import Docker from 'dockerode'
import {
  listContainers,
  startContainer,
  stopContainer,
  restartContainer,
  getContainerLogs,
  getContainerStatus,
  getContainerImage,
  pullContainerImage,
  getContainerStats,
} from '../../src/clients/docker'

jest.mock('dockerode')
const MockDocker = Docker as jest.MockedClass<typeof Docker>

function makeContainerMock(overrides: Partial<Docker.ContainerInfo> = {}): Docker.ContainerInfo {
  return {
    Id: 'abc123',
    Names: ['/myapp'],
    Image: 'myapp:latest',
    ImageID: 'sha256:abc',
    Command: '',
    Created: 0,
    Ports: [],
    Labels: {},
    State: 'running',
    Status: 'Up 2 hours',
    HostConfig: { NetworkMode: 'bridge' },
    NetworkSettings: { Networks: {} },
    Mounts: [],
    ...overrides,
  }
}

describe('Docker client', () => {
  let mockInstance: jest.Mocked<Docker>
  let mockContainer: jest.Mocked<Docker.Container>

  beforeEach(() => {
    mockContainer = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      restart: jest.fn().mockResolvedValue(undefined),
      logs: jest.fn(),
      inspect: jest.fn(),
      stats: jest.fn(),
    } as unknown as jest.Mocked<Docker.Container>

    mockInstance = {
      listContainers: jest.fn(),
      getContainer: jest.fn().mockReturnValue(mockContainer),
      pull: jest.fn(),
      modem: { followProgress: jest.fn() },
    } as unknown as jest.Mocked<Docker>

    MockDocker.mockImplementation(() => mockInstance)
  })

  it('listContainers returns mapped summaries', async () => {
    mockInstance.listContainers.mockResolvedValue([makeContainerMock()])
    const result = await listContainers()
    expect(result).toEqual([{
      id: 'abc123',
      name: 'myapp',
      status: 'Up 2 hours',
      state: 'running',
      image: 'myapp:latest',
    }])
  })

  it('startContainer calls container.start', async () => {
    mockInstance.listContainers.mockResolvedValue([makeContainerMock()])
    await startContainer('myapp')
    expect(mockContainer.start).toHaveBeenCalled()
  })

  it('stopContainer calls container.stop', async () => {
    mockInstance.listContainers.mockResolvedValue([makeContainerMock()])
    await stopContainer('myapp')
    expect(mockContainer.stop).toHaveBeenCalled()
  })

  it('restartContainer calls container.restart', async () => {
    mockInstance.listContainers.mockResolvedValue([makeContainerMock()])
    await restartContainer('myapp')
    expect(mockContainer.restart).toHaveBeenCalled()
  })

  it('throws when container not found', async () => {
    mockInstance.listContainers.mockResolvedValue([])
    await expect(startContainer('missing')).rejects.toThrow('Container not found: missing')
  })

  it('getContainerImage returns image from inspect', async () => {
    mockInstance.listContainers.mockResolvedValue([makeContainerMock()])
    mockContainer.inspect.mockResolvedValue({ Config: { Image: 'myapp:latest' } } as Docker.ContainerInspectInfo)
    const image = await getContainerImage('myapp')
    expect(image).toBe('myapp:latest')
  })

  it('getContainerStats returns cpu and memory strings', async () => {
    mockInstance.listContainers.mockResolvedValue([makeContainerMock()])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockContainer.stats as any).mockImplementation((_opts: unknown, cb: Function) => {
      cb(null, {
        cpu_stats: { cpu_usage: { total_usage: 2000000 }, system_cpu_usage: 100000000, online_cpus: 4 },
        precpu_stats: { cpu_usage: { total_usage: 1000000 }, system_cpu_usage: 90000000 },
        memory_stats: { usage: 52428800, limit: 8589934592 },
      })
    })
    const result = await getContainerStats('myapp')
    expect(result.cpu).toMatch(/%$/)
    expect(result.memory).toMatch(/MB/)
  })
})
