import { NextRequest } from 'next/server'
import { z } from 'zod'
import { setTxidExclusion } from '@/lib/db'

const schema = z.object({
  txid:    z.string().min(1).max(50),
  exclude: z.boolean(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return Response.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  await setTxidExclusion(result.data.txid, result.data.exclude)
  return Response.json({ success: true })
}
