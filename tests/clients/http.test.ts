import axios from 'axios'
import { post } from '../../src/clients/http'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('post', () => {
  it('sends a POST request with headers and returns response data', async () => {
    mockedAxios.post.mockResolvedValue({ data: { ok: true } })

    const result = await post<{ ok: boolean }>(
      'https://example.com/api/log',
      { work: 'project', date: '2026-04-12', time_spent: '2h' },
      { Authorization: 'Bearer secret', 'Content-Type': 'application/json' }
    )

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://example.com/api/log',
      { work: 'project', date: '2026-04-12', time_spent: '2h' },
      { headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' } }
    )
    expect(result).toEqual({ ok: true })
  })

  it('propagates axios errors', async () => {
    mockedAxios.post.mockRejectedValue(new Error('Network error'))
    await expect(post('https://example.com/api', {})).rejects.toThrow('Network error')
  })
})
