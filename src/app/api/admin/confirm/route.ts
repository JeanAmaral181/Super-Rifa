import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getNumbers, saveNumbers, withLock } from '@/lib/db'

const schema = z.object({
  txid: z.string().min(1).max(50),
})

export async function POST(request: NextRequest) {
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

  const { txid } = result.data

  try {
    return await withLock(async () => {
      const data = await getNumbers()

      let count = 0
      for (const [key, entry] of Object.entries(data)) {
        if (entry.txid === txid && entry.status === 'reserved') {
          data[key] = { ...entry, status: 'paid' }
          count++
        }
      }

      if (count === 0) {
        return Response.json({ error: 'Transação não encontrada' }, { status: 404 })
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
