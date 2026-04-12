import axios from 'axios'
import { inflateRaw } from 'zlib'
import { promisify } from 'util'

const inflate = promisify(inflateRaw)

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

  try {
    const { data } = await axios.get(`https://pobb.in/${code}/raw`, { timeout: 8000, responseType: 'text' })
    if (typeof data === 'string' && data.trim().length > 0) return data.trim()
  } catch { /* fall through */ }

  const { data: html } = await axios.get(`https://pobb.in/${code}`, { timeout: 8000 })
  const match = String(html).match(/(?:buildCode|build_code|raw)['":\s]+['"]([A-Za-z0-9+/=_-]{20,})['"]/)
  if (match) return match[1]

  throw new Error(`Could not extract build code from ${input}`)
}

export async function analyzePob(input: string): Promise<PoBSummary> {
  const base64 = await fetchBase64(input)
  const buf = Buffer.from(base64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const xml = (await inflate(buf)).toString('utf8')

  const buildClass = extractAttr(xml, 'Build', 'className') || extractAttr(xml, 'Build', 'class')
  const ascendancy = extractAttr(xml, 'Build', 'ascendClassName')
  const level = extractAttr(xml, 'Build', 'level')
  const bandit = extractAttr(xml, 'Build', 'bandit')
  const mainSkill = parseMainSkill(xml)
  const stats = parseStats(xml)
  const notables = parseNotables(xml)

  return { class: buildClass, ascendancy, level, bandit, mainSkill, stats, notables }
}
