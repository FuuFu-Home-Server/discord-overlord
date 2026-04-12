import axios from 'axios'
import { inflate, inflateRaw, gunzip } from 'zlib'
import { promisify } from 'util'

const tryInflate = promisify(inflate)
const tryInflateRaw = promisify(inflateRaw)
const tryGunzip = promisify(gunzip)

async function decompress(buf: Buffer): Promise<Buffer> {
  const attempts = [tryInflate, tryInflateRaw, tryGunzip]
  for (const fn of attempts) {
    try {
      return await fn(buf)
    } catch { /* try next */ }
  }
  throw new Error('Failed to decompress PoB data — not a valid zlib/deflate/gzip stream')
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i'))
  return match?.[1] ?? ''
}

function extractAllAttrs(xml: string, tag: string, attr: string): string[] {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'gi')
  const results: string[] = []
  let m
  while ((m = re.exec(xml)) !== null) results.push(m[1])
  return results
}

function extractSection(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'i'))
  return match?.[0] ?? ''
}

function parseMainSkill(xml: string): string {
  const skills = [...xml.matchAll(/<Skill[^>]*>([\s\S]*?)<\/Skill>/gi)]
  for (const skill of skills) {
    const block = skill[0]
    if (/mainActiveSkill="1"|mainActive="1"/.test(block)) {
      const gems = [...block.matchAll(/<Gem[^>]*nameSpec="([^"]*)"[^>]*\/>/gi)].map(m => m[1])
      const label = extractAttr(block, 'Skill', 'label') || extractAttr(block, 'Skill', 'slot')
      return `${label ? label + ': ' : ''}${gems.join(' + ')}`
    }
  }
  const first = skills[0]?.[0] ?? ''
  const gems = [...first.matchAll(/<Gem[^>]*nameSpec="([^"]*)"[^>]*\/>/gi)].map(m => m[1])
  return gems.join(' + ') || 'Unknown'
}

function parseStats(xml: string): Record<string, string> {
  const statsSection = extractSection(xml, 'Stats') || extractSection(xml, 'Build')
  const stats: Record<string, string> = {}
  const wanted = ['Life', 'EnergyShield', 'Mana', 'FullDPS', 'TotalDPS', 'AverageDamage',
    'FireResist', 'ColdResist', 'LightningResist', 'ChaosResist', 'Armour', 'Evasion']
  for (const key of wanted) {
    const m = statsSection.match(new RegExp(`${key}="([^"]*)"`, 'i'))
      ?? xml.match(new RegExp(`<Stat[^>]*stat="${key}"[^>]*value="([^"]*)"`, 'i'))
    if (m) stats[key] = m[1]
  }
  return stats
}

function parseNotables(xml: string): string[] {
  const treeSection = extractSection(xml, 'Tree')
  if (!treeSection) return []
  return extractAllAttrs(treeSection, 'Node', 'name')
    .filter(n => n.length > 2)
    .slice(0, 20)
}

export interface PoBSummary {
  class: string
  ascendancy: string
  level: string
  bandit: string
  mainSkill: string
  stats: Record<string, string>
  notables: string[]
}

async function fetchBase64(input: string): Promise<string> {
  if (!input.startsWith('http')) return input

  const url = new URL(input)
  const code = url.pathname.replace(/^\//, '').split('/')[0]

  // pobb.in API endpoint
  try {
    const { data } = await axios.get(`https://pobb.in/api/get?code=${code}`, {
      timeout: 8000,
      headers: { Accept: 'application/json' },
    })
    if (data?.encoded) return String(data.encoded)
    if (data?.data) return String(data.data)
  } catch { /* fall through */ }

  // raw text endpoint
  try {
    const { data } = await axios.get(`https://pobb.in/${code}/raw`, {
      timeout: 8000,
      responseType: 'text',
      headers: { Accept: 'text/plain' },
    })
    const text = String(data).trim()
    if (text.length > 20 && !text.startsWith('<')) return text
  } catch { /* fall through */ }

  // scrape HTML
  const { data: html } = await axios.get(`https://pobb.in/${code}`, { timeout: 8000 })
  const htmlStr = String(html)
  const patterns = [
    /(?:buildCode|build_code|encoded|pasteData)['":\s]+['"]([A-Za-z0-9+/=_-]{50,})['"]/,
    /<textarea[^>]*>([A-Za-z0-9+/=_-]{50,})<\/textarea>/,
    /value="([A-Za-z0-9+/=_-]{100,})"/,
  ]
  for (const pattern of patterns) {
    const match = htmlStr.match(pattern)
    if (match) return match[1]
  }

  throw new Error(`Could not extract build code from ${input}`)
}

export async function analyzePob(input: string): Promise<PoBSummary> {
  const base64 = await fetchBase64(input)
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
  const buf = Buffer.from(normalized, 'base64')
  const xml = (await decompress(buf)).toString('utf8')

  const buildClass = extractAttr(xml, 'Build', 'className') || extractAttr(xml, 'Build', 'class')
  const ascendancy = extractAttr(xml, 'Build', 'ascendClassName')
  const level = extractAttr(xml, 'Build', 'level')
  const bandit = extractAttr(xml, 'Build', 'bandit')
  const mainSkill = parseMainSkill(xml)
  const stats = parseStats(xml)
  const notables = parseNotables(xml)

  return { class: buildClass, ascendancy, level, bandit, mainSkill, stats, notables }
}
