import { Client } from 'discord.js'
import * as dockerClient from '../../src/clients/docker'
import { startContainerWatcher } from '../../src/monitors/container-watcher'
import type { DockerEvent } from '../../src/clients/docker'

jest.mock('../../src/clients/docker')
const mockedDocker = dockerClient as jest.Mocked<typeof dockerClient>

type FakeChannel = { isSendable: () => boolean; send: jest.Mock }

function makeClient(channel?: FakeChannel): jest.Mocked<Client> {
  return {
    channels: {
      cache: {
        get: jest.fn().mockReturnValue(channel ?? undefined),
      },
    },
  } as unknown as jest.Mocked<Client>
}

describe('startContainerWatcher', () => {
  it('sends a crash alert embed when a container dies', () => {
    let capturedCallback: ((event: DockerEvent) => void) | null = null
    mockedDocker.streamEvents.mockImplementation((cb) => { capturedCallback = cb })

    const sendMock = jest.fn().mockResolvedValue(undefined)
    const client = makeClient({ isSendable: () => true, send: sendMock })

    startContainerWatcher(client, 'alerts-channel-id')

    capturedCallback!({
      Type: 'container',
      Action: 'die',
      time: 1712880000,
      id: 'abc123',
      Actor: { Attributes: { name: 'myapp', exitCode: '1' } },
    })

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })

  it('sends an OOM alert embed when a container is OOM killed', () => {
    let capturedCallback: ((event: DockerEvent) => void) | null = null
    mockedDocker.streamEvents.mockImplementation((cb) => { capturedCallback = cb })

    const sendMock = jest.fn().mockResolvedValue(undefined)
    const client = makeClient({ isSendable: () => true, send: sendMock })

    startContainerWatcher(client, 'alerts-channel-id')

    capturedCallback!({
      Type: 'container',
      Action: 'oom',
      time: 1712880000,
      id: 'abc123',
      Actor: { Attributes: { name: 'myapp', exitCode: '137' } },
    })

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })

  it('does not alert for non-die/oom events', () => {
    let capturedCallback: ((event: DockerEvent) => void) | null = null
    mockedDocker.streamEvents.mockImplementation((cb) => { capturedCallback = cb })

    const sendMock = jest.fn()
    const client = makeClient({ isSendable: () => true, send: sendMock })

    startContainerWatcher(client, 'alerts-channel-id')
    capturedCallback!({ Type: 'container', Action: 'start', time: 0, id: 'x', Actor: { Attributes: {} } })

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('does nothing when alerts channel is not found', () => {
    let capturedCallback: ((event: DockerEvent) => void) | null = null
    mockedDocker.streamEvents.mockImplementation((cb) => { capturedCallback = cb })

    const client = makeClient() // no channel
    startContainerWatcher(client, 'missing-channel')

    expect(() => capturedCallback!({
      Type: 'container',
      Action: 'die',
      time: 0,
      id: 'x',
      Actor: { Attributes: { name: 'app', exitCode: '137' } },
    })).not.toThrow()
  })
})
