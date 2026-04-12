import { Client } from 'discord.js'
import { chat, getLastMessageTime } from '../clients/priestess'
import { getSystemStats } from '../clients/system'

const WIB_OFFSET = 7 * 60

function nowWIB(): Date {
  const now = new Date()
  now.setMinutes(now.getMinutes() + now.getTimezoneOffset() + WIB_OFFSET)
  return now
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

async function sendProactive(client: Client, channelId: string, userId: string, prompt: string): Promise<void> {
  const channel = client.channels.cache.get(channelId)
  if (!channel?.isSendable()) return
  const reply = await chat(userId, prompt)
  await channel.send(`<@${userId}> ${reply}`)
}

async function morningBriefing(client: Client, channelId: string, userId: string): Promise<void> {
  try {
    const stats = await getSystemStats()
    const cpu = `${stats.cpuLoad.toFixed(1)}%`
    const mem = `${formatBytes(stats.memUsedBytes)} / ${formatBytes(stats.memTotalBytes)}`
    await sendProactive(client, channelId, userId,
      `[SYSTEM: Morning briefing trigger — 08:00 WIB. Server stats: CPU ${cpu}, Memory ${mem}. Give Irfan a warm good morning, mention the server is healthy, and set a positive tone for his workday. Be brief and natural.]`
    )
  } catch (err) {
    console.error('Morning briefing error:', err)
  }
}

async function eveningWrapUp(client: Client, channelId: string, userId: string): Promise<void> {
  try {
    await sendProactive(client, channelId, userId,
      `[SYSTEM: Evening wrap-up trigger — 17:00 WIB, end of Irfan's workday. Check in warmly, ask how his day went, encourage him to rest or work out. Be brief and natural.]`
    )
  } catch (err) {
    console.error('Evening wrap-up error:', err)
  }
}

async function checkIdle(client: Client, channelId: string, userId: string): Promise<void> {
  try {
    const lastTime = await getLastMessageTime(userId)
    if (!lastTime) return
    const daysSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince >= 3) {
      await sendProactive(client, channelId, userId,
        `[SYSTEM: Idle check-in — Irfan hasn't spoken in ${Math.floor(daysSince)} days. Reach out gently, let him know you've noticed and you're here. Be warm, not clingy.]`
      )
    }
  } catch (err) {
    console.error('Idle check error:', err)
  }
}

export function startPriestessScheduler(client: Client, channelId: string, userId: string): void {
  const tick = async () => {
    const now = nowWIB()
    const h = now.getHours()
    const m = now.getMinutes()
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5

    if (h === 8 && m === 0 && isWeekday) await morningBriefing(client, channelId, userId)
    if (h === 17 && m === 0 && isWeekday) await eveningWrapUp(client, channelId, userId)
    if (h === 9 && m === 0) await checkIdle(client, channelId, userId)
  }

  const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000
  setTimeout(() => {
    void tick()
    setInterval(() => void tick(), 60 * 1000)
  }, msUntilNextMinute)
}
