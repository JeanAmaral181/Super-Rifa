import { NextRequest } from 'next/server'
import { getNumbers, EXPIRE_MS } from '@/lib/db'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const ip = getIP(request)
  const allowed = await checkRateLimit(ip, 'status', 20, 60)
  if (!allowed) {
    return Response.json({ error: 'Muitas requisições. Tente em breve.' }, { status: 429 })
  }

  const q = request.nextUrl.searchParams.get('q')?.toLowerCase().trim()
  if (!q || q.length < 3) {
    return Response.json({ error: 'Digite pelo menos 3 caracteres' }, { status: 400 })
  }

  const data = await getNumbers()
  const now = Date.now()

  const results = Object.entries(data)
    .filter(([, entry]) => entry.status === 'paid' || now - entry.ts <= EXPIRE_MS)
    .filter(([, entry]) => {
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.phone.includes(q)
      )
    })
    .map(([number, entry]) => ({
      number,
      status: entry.status,
    }))
    .sort((a, b) => Number(a.number) - Number(b.number))

  return Response.json({ results })
}
