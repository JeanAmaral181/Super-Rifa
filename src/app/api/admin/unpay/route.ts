import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getNumbers, saveNumbers, withLock, redis } from '@/lib/db'
import { requireAdmin } from '@/lib/auth.server'

const schema = z.object({
  txid: z.string().min(1).max(50),
})

const EXCLUDED_KEY = 'rifa:draw:excluded'

export async function DELETE(request: NextRequest) {
  const authErr = await requireAdmin()
  if (authErr) return authErr

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { txid } = parsed.data

  try {
    return await withLock(async () => {
      const data = await getNumbers()
      let count = 0

      for (const key of Object.keys(data)) {
        if (data[key].txid === txid) {
          delete data[key]
          count++
        }
      }

      if (count === 0) {
        return Response.json({ error: 'Nenhuma entrada encontrada para este txid' }, { status: 404 })
      }

      await Promise.all([
        saveNumbers(data),
        redis.srem(EXCLUDED_KEY, txid),
      ])
      return Response.json({ success: true, count })
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes('ocupado')) {
      return Response.json({ error: e.message }, { status: 503 })
    }
    throw e
  }
}
