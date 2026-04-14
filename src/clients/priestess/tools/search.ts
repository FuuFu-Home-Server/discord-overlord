import axios from 'axios'

export async function handleWebSearch(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const query = encodeURIComponent(String(args.query))
  const { data } = await axios.get(
    `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=1`,
    { timeout: 8000, headers: { 'User-Agent': 'discord-overlord/1.0' } },
  )
  const results: string[] = []
  if (data.AbstractText) results.push(`Summary: ${data.AbstractText}`)
  if (data.Answer) results.push(`Answer: ${data.Answer}`)
  if (Array.isArray(data.RelatedTopics)) {
    for (const t of data.RelatedTopics.slice(0, 5)) {
      if (t.Text) results.push(t.Text)
    }
  }
  return {
    query: args.query,
    results: results.length ? results : ['No results found — try a more specific query'],
  }
}
