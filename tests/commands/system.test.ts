import { ChatInputCommandInteraction, GuildMember } from 'discord.js'
import * as systemClient from '../../src/clients/system'
import command, { setAdminRoleId } from '../../src/commands/system/index'

jest.mock('../../src/clients/system')
const mockedSystem = systemClient as jest.Mocked<typeof systemClient>

function makeInteraction(roleIds: string[] = ['adminrole']): jest.Mocked<ChatInputCommandInteraction> {
  return {
    member: {
      roles: { cache: { has: jest.fn((id: string) => roleIds.includes(id)) } },
    } as unknown as GuildMember,
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ChatInputCommandInteraction>
}

beforeAll(() => {
  setAdminRoleId('adminrole')
})

describe('system command', () => {
  it('replies with system stats embed', async () => {
    mockedSystem.getSystemStats.mockResolvedValue({
      cpuLoad: 23.4,
      memUsedBytes: 2147483648,
      memTotalBytes: 8589934592,
      diskUsedBytes: 53687091200,
      diskTotalBytes: 268435456000,
      uptimeSeconds: 172800,
    })

    const interaction = makeInteraction()
    await command.execute(interaction)

    expect(interaction.deferReply).toHaveBeenCalled()
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }))
  })

  it('denies when role is missing', async () => {
    const interaction = makeInteraction([])
    await command.execute(interaction)
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }))
    expect(mockedSystem.getSystemStats).not.toHaveBeenCalled()
  })
})
