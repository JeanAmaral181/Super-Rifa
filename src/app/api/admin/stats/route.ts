import { getNumbers, computeStats, getExcludedTxids, EXPIRE_MS } from '@/lib/db'

export async function GET() {
  const [data, excludedTxids] = await Promise.all([getNumbers(), getExcludedTxids()])
  const stats = computeStats(data)

  // Group entries by txid for the admin table
  const groups: Record<
    string,
    {
      txid: string
      numbers: string[]
      name: string
      phone: string
      status: 'reserved' | 'paid'
      ts: number
    }
  > = {}

  const now = Date.now()

  for (const [num, entry] of Object.entries(data)) {
    if (!groups[entry.txid]) {
      groups[entry.txid] = {
        txid: entry.txid,
        numbers: [],
        name: entry.name,
        phone: entry.phone,
        status: entry.status,
        ts: entry.ts,
      }
    }
    groups[entry.txid].numbers.push(num)
    // If any number in the group is paid, the whole group is paid
    if (entry.status === 'paid') {
      groups[entry.txid].status = 'paid'
    }
  }

  const entries = Object.values(groups).sort((a, b) => b.ts - a.ts)

  // Recount expired with the grouped view
  const expired = entries.filter(
    e => e.status === 'reserved' && now - e.ts > EXPIRE_MS
  ).length

  return Response.json({ ...stats, expired, entries, excludedTxids })
}
