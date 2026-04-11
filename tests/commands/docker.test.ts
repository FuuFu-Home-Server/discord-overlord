import { ChatInputCommandInteraction, GuildMember } from 'discord.js'
import * as dockerClient from '../../src/clients/docker'
import { handleList } from '../../src/commands/docker/list'
import { handleStart } from '../../src/commands/docker/start'
import { handleStop } from '../../src/commands/docker/stop'
import { handleRestart } from '../../src/commands/docker/restart'
import { handleLogs } from '../../src/commands/docker/logs'
import { handleStatus } from '../../src/commands/docker/status'
import { handlePull } from '../../src/commands/docker/pull'
import { handleStats } from '../../src/commands/docker/stats'

jest.mock('../../src/clients/docker')
const mockedDocker = dockerClient as jest.Mocked<typeof dockerClient>

function makeInteraction(
  subcommand: string,
  options: Record<string, string | number> = {},
  roleIds: string[] = ['adminrole']
): jest.Mocked<ChatInputCommandInteraction> {
  return {
    options: {
      getSubcommand: jest.fn().mockReturnValue(subcommand),
      getString: jest.fn((key: string) => options[key] as string ?? null),
      getInteger: jest.fn((key: string) => options[key] as number ?? null),
    },
    member: {
      roles: { cache: { has: jest.fn((id: string) => roleIds.includes(id)) } },
    } as unknown as GuildMember,
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ChatInputCommandInteraction>
}

const ADMIN_ROLE = 'adminrole'

describe('handleList', () => {
  it('replies with container list embed', async () => {
    mockedDocker.listContainers.mockResolvedValue([
      { id: 'abc', name: 'nginx', status: 'Up 2 hours', state: 'running', image: 'nginx:latest' },
    ])
    const interaction = makeInteraction('list')
    await handleList(interaction, ADMIN_ROLE)
    expect(interaction.deferReply).toHaveBeenCalled()
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })

  it('replies with no permission when role missing', async () => {
    const interaction = makeInteraction('list', {}, [])
    await handleList(interaction, ADMIN_ROLE)
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }))
    expect(mockedDocker.listContainers).not.toHaveBeenCalled()
  })
})

describe('handleStart', () => {
  it('starts named container and replies with success', async () => {
    mockedDocker.startContainer.mockResolvedValue(undefined)
    const interaction = makeInteraction('start', { container: 'nginx' })
    await handleStart(interaction, ADMIN_ROLE)
    expect(mockedDocker.startContainer).toHaveBeenCalledWith('nginx')
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })

  it('replies with error on docker failure', async () => {
    mockedDocker.startContainer.mockRejectedValue(new Error('Container not found: nginx'))
    const interaction = makeInteraction('start', { container: 'nginx' })
    await handleStart(interaction, ADMIN_ROLE)
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Container not found'))
  })
})

describe('handleStop', () => {
  it('stops container and replies with success', async () => {
    mockedDocker.stopContainer.mockResolvedValue(undefined)
    const interaction = makeInteraction('stop', { container: 'nginx' })
    await handleStop(interaction, ADMIN_ROLE)
    expect(mockedDocker.stopContainer).toHaveBeenCalledWith('nginx')
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })
})

describe('handleRestart', () => {
  it('restarts container and replies with success', async () => {
    mockedDocker.restartContainer.mockResolvedValue(undefined)
    const interaction = makeInteraction('restart', { container: 'nginx' })
    await handleRestart(interaction, ADMIN_ROLE)
    expect(mockedDocker.restartContainer).toHaveBeenCalledWith('nginx')
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })
})

describe('handleLogs', () => {
  it('fetches logs with default tail of 50', async () => {
    mockedDocker.getContainerLogs.mockResolvedValue('log line 1\nlog line 2')
    const interaction = makeInteraction('logs', { container: 'nginx' })
    await handleLogs(interaction, ADMIN_ROLE)
    expect(mockedDocker.getContainerLogs).toHaveBeenCalledWith('nginx', 50)
  })

  it('fetches logs with provided tail value', async () => {
    mockedDocker.getContainerLogs.mockResolvedValue('log line 1')
    const interaction = makeInteraction('logs', { container: 'nginx', lines: 100 })
    await handleLogs(interaction, ADMIN_ROLE)
    expect(mockedDocker.getContainerLogs).toHaveBeenCalledWith('nginx', 100)
  })
})

describe('handleStatus', () => {
  it('inspects container and replies with embed', async () => {
    mockedDocker.getContainerStatus.mockResolvedValue({
      Name: '/nginx',
      State: { Status: 'running', StartedAt: '2026-04-12T00:00:00Z', RestartCount: 0 },
      Config: { Image: 'nginx:latest' },
    } as unknown as import('dockerode').ContainerInspectInfo)
    const interaction = makeInteraction('status', { container: 'nginx' })
    await handleStatus(interaction, ADMIN_ROLE)
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })
})

describe('handlePull', () => {
  it('gets image name, pulls it, and replies with success', async () => {
    mockedDocker.getContainerImage.mockResolvedValue('nginx:latest')
    mockedDocker.pullContainerImage.mockResolvedValue(undefined)
    const interaction = makeInteraction('pull', { container: 'nginx' })
    await handlePull(interaction, ADMIN_ROLE)
    expect(mockedDocker.getContainerImage).toHaveBeenCalledWith('nginx')
    expect(mockedDocker.pullContainerImage).toHaveBeenCalledWith('nginx:latest')
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })
})

describe('handleStats', () => {
  it('returns cpu and memory stats in embed', async () => {
    mockedDocker.getContainerStats.mockResolvedValue({ cpu: '12.34%', memory: '256.0 MB / 8.00 GB' })
    const interaction = makeInteraction('stats', { container: 'nginx' })
    await handleStats(interaction, ADMIN_ROLE)
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })
})
