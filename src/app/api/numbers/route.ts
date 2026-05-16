import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import {
  getNumbers,
  saveNumbers,
  autoExpire,
  computeStats,
  withLock,
  TOTAL_NUMBERS,
  PRICE_PER_NUMBER,
  EXPIRE_MS,
  type NumbersRecord,
} from '@/lib/db'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

const reserveSchema = z.object({
  numbers: z
    .array(z.number().int().min(1).max(TOTAL_NUMBERS))
    .min(1)
    .max(50),
  name: z.string().min(2).max(100).trim(),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\d+$/, 'WhatsApp deve conter apenas números'),
})

export async function GET(request: NextRequest) {
  const ip = getIP(request)
  const allowed = await checkRateLimit(ip, 'numbers-get', 20, 60)
  if (!allowed) {
    return Response.json({ error: 'Muitas requisições. Tente em breve.' }, { status: 429 })
  }

  const data = await getNumbers()

  // Filtra expirados apenas para resposta — sem gravar no Redis (evita race condition
  // com operações POST que usam withLock para salvar reservas novas)
  const now = Date.now()
  const active: NumbersRecord = {}
  for (const [k, v] of Object.entries(data)) {
    if (v.status === 'paid' || now - v.ts <= EXPIRE_MS) {
      active[k] = v
    }
  }

  const stats = computeStats(active)

  // Expõe apenas o status — nunca nome, telefone ou txid para visitantes
  const publicTaken = Object.fromEntries(
    Object.entries(active).map(([k, v]) => [k, { status: v.status }])
  )
  return Response.json({ taken: publicTaken, stats }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const ip = getIP(request)
  const allowed = await checkRateLimit(ip, 'numbers-reserve', 15, 60)
  if (!allowed) {
    return Response.json({ error: 'Muitas requisições. Tente em breve.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  const result = reserveSchema.safeParse(body)
  if (!result.success) {
    return Response.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { numbers, name, phone } = result.data

  try {
    return await withLock(async () => {
      const data = await getNumbers()
      await autoExpire(data)

      const unavailable = numbers.filter(n => data[String(n)])
      if (unavailable.length > 0) {
        return Response.json(
          { error: `Números não disponíveis: ${unavailable.join(', ')}` },
          { status: 409 }
        )
      }

      const txid = randomBytes(8).toString('hex').toUpperCase()
      const ts = Date.now()

      for (const n of numbers) {
        data[String(n)] = { status: 'reserved', name, phone, ts, txid }
      }

      await saveNumbers(data)

      return Response.json({
        txid,
        count: numbers.length,
        amount: numbers.length * PRICE_PER_NUMBER,
        numbers,
      })
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes('ocupado')) {
      return Response.json({ error: e.message }, { status: 503 })
    }
    throw e
  }
}
