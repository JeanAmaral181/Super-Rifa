import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getNumbers, saveNumbers, withLock, EXPIRE_MS } from '@/lib/db'
import { requireAdmin } from '@/lib/auth.server'

const schema = z.object({
  txid: z.string().min(1).max(50).optional(),
})

export async function DELETE(request: NextRequest) {
  const authErr = await requireAdmin()
  if (authErr) return authErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const result = schema.safeParse(body)
  const txid = result.success ? result.data.txid : undefined

  try {
    return await withLock(async () => {
      const data = await getNumbers()
      const now = Date.now()
      let count = 0

      for (const key of Object.keys(data)) {
        const entry = data[key]
        if (txid) {
          if (entry.txid === txid && entry.status === 'reserved') {
            delete data[key]
            count++
          }
        } else {
          if (entry.status === 'reserved' && now - entry.ts > EXPIRE_MS) {
            delete data[key]
            count++
          }
        }
      }

      await saveNumbers(data)
      return Response.json({ success: true, count })
    })
  } catch (e) {
    if (e instanceof Error && e.message.includes('ocupado')) {
      return Response.json({ error: e.message }, { status: 503 })
    }
    throw e
  }
}
