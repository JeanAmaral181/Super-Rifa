import { NextRequest } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { getNumbers, saveNumbers, autoExpire, withLock, TOTAL_NUMBERS } from '@/lib/db'
import { requireAdmin } from '@/lib/auth.server'

const schema = z.object({
  numbers: z.string().min(1),
  name: z.string().min(2).max(100).trim(),
  phone: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\d+$/, 'WhatsApp deve conter apenas números'),
})

export async function POST(request: NextRequest) {
  const authErr = await requireAdmin()
  if (authErr) return authErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return Response.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { numbers: numbersStr, name, phone } = result.data

  // Aceita lista ("1, 2, 3"), ranges ("1-500") ou mistura ("1-10, 50, 100-200")
  const numbers: number[] = []
  for (const part of numbersStr.split(',')) {
    const s = part.trim()
    const range = s.match(/^(\d+)-(\d+)$/)
    if (range) {
      const from = Math.max(1, parseInt(range[1], 10))
      const to   = Math.min(TOTAL_NUMBERS, parseInt(range[2], 10))
      for (let i = from; i <= to; i++) numbers.push(i)
    } else {
      const n = parseInt(s, 10)
      if (!isNaN(n) && n >= 1 && n <= TOTAL_NUMBERS) numbers.push(n)
    }
  }
  // Deduplica mantendo ordem
  const unique = [...new Set(numbers)]

  if (unique.length === 0) {
    return Response.json({ error: 'Nenhum número válido informado' }, { status: 400 })
  }

  try {
    return await withLock(async () => {
      const data = await getNumbers()
      await autoExpire(data)

      const alreadyPaid = unique.filter(n => data[String(n)]?.status === 'paid')
      if (alreadyPaid.length > 0) {
        return Response.json(
          { error: `Números já pagos: ${alreadyPaid.slice(0, 10).join(', ')}${alreadyPaid.length > 10 ? '…' : ''}` },
          { status: 409 }
        )
      }

      const txid = randomBytes(8).toString('hex').toUpperCase()
      const ts = Date.now()

      for (const n of unique) {
        data[String(n)] = { status: 'paid', name, phone, ts, txid }
      }

      await saveNumbers(data)
      return Response.json({ success: true, txid, count: unique.length })
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes('ocupado')) {
      return Response.json({ error: e.message }, { status: 503 })
    }
    throw e
  }
}
