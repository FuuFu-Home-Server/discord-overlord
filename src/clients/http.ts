import axios from 'axios'

export async function post<T>(
  url: string,
  data: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  const response = await axios.post<T>(url, data, { headers })
  return response.data
}
