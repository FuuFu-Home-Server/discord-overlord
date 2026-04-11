import { ChatInputCommandInteraction, GuildMember } from 'discord.js'
import * as httpClient from '../../src/clients/http'
import worklogCommand from '../../src/commands/worklog/index'

jest.mock('../../src/clients/http')
const mockedHttp = httpClient as jest.Mocked<typeof httpClient>

function makeInteraction(
  options: Record<string, string> = {},
  roleIds: string[] = ['workrole']
): jest.Mocked<ChatInputCommandInteraction> {
  return {
    options: {
      getString: jest.fn((key: string) => options[key] ?? null),
    },
    member: {
      roles: { cache: { has: jest.fn((id: string) => roleIds.includes(id)) } },
    } as unknown as GuildMember,
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ChatInputCommandInteraction>
}

beforeAll(() => {
  worklogCommand.setWorklogConfig('https://example.com/api/log', 'secret', 'workrole')
})

describe('worklog command', () => {
  it('posts work log entry and replies with success embed', async () => {
    mockedHttp.post.mockResolvedValue({ message: 'Logged.' })
    const interaction = makeInteraction({ work: 'discord-overlord', date: '2026-04-12', time_spent: '3h' })

    await worklogCommand.execute(interaction)

    expect(mockedHttp.post).toHaveBeenCalledWith(
      'https://example.com/api/log',
      { work: 'discord-overlord', date: '2026-04-12', time_spent: '3h' },
      { Authorization: 'Bearer secret', 'Content-Type': 'application/json' }
    )
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })

  it('replies with error message on API failure', async () => {
    mockedHttp.post.mockRejectedValue(
      Object.assign(new Error('Bad request'), {
        response: { data: { message: 'Invalid date format' } },
      })
    )
    const interaction = makeInteraction({ work: 'x', date: 'bad', time_spent: '1h' })
    await worklogCommand.execute(interaction)
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Error'))
  })

  it('denies when role is missing', async () => {
    const interaction = makeInteraction({ work: 'x', date: '2026-04-12', time_spent: '1h' }, [])
    await worklogCommand.execute(interaction)
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }))
    expect(mockedHttp.post).not.toHaveBeenCalled()
  })
})
