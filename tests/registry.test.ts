import path from 'path'
import { loadCommands } from '../src/registry'

describe('loadCommands', () => {
  it('returns an empty array for an empty directory', async () => {
    const commands = await loadCommands(path.join(__dirname, 'fixtures/commands'))
    expect(Array.isArray(commands)).toBe(true)
    expect(commands).toHaveLength(0)
  })

  it('returns an empty array for a non-existent directory', async () => {
    const commands = await loadCommands('/does/not/exist')
    expect(commands).toHaveLength(0)
  })
})
