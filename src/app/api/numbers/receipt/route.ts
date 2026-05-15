import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getNumbers, PRICE_PER_NUMBER } from '@/lib/db'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

const schema = z.object({
  txid: z.string().min(1).max(50).regex(/^[A-Za-z0-9-]+$/, 'txid inválido'),
})

export async function GET(request: NextRequest) {
  const ip = getIP(request)
  const allowed = await checkRateLimit(ip, 'receipt', 15, 60)
  if (!allowed) {
    return Response.json({ error: 'Muitas requisições. Tente em breve.' }, { status: 429 })
  }

  const q = request.nextUrl.searchParams.get('txid')
  const parsed = schema.safeParse({ txid: q })
  if (!parsed.success) {
    return Response.json({ error: 'txid inválido' }, { status: 400 })
  }
  const { txid } = parsed.data

  const data = await getNumbers()
  const entries = Object.entries(data).filter(([, e]) => e.txid === txid)

  if (entries.length === 0) {
    return Response.json({ error: 'Compra não encontrada ou expirada' }, { status: 404 })
  }

  const status = entries.some(([, e]) => e.status === 'paid') ? 'paid' : 'reserved'
  const numbers = entries.map(([n]) => Number(n)).sort((a, b) => a - b)
  const name = entries[0][1].name

  return Response.json({
    txid,
    name,
    numbers,
    count: numbers.length,
    amount: numbers.length * PRICE_PER_NUMBER,
    status,
  })
}
