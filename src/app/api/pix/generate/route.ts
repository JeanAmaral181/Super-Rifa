import { NextRequest } from 'next/server'
import { z } from 'zod'
import QRCode from 'qrcode'
import { generatePixEMV } from '@/lib/pix.server'
import { getNumbers, PRICE_PER_NUMBER } from '@/lib/db'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

const schema = z.object({
  txid: z.string().min(1).max(50).regex(/^[A-Za-z0-9-]+$/, 'txid inválido'),
  buyerName: z.string().min(2).max(100).trim(),
})

export async function POST(request: NextRequest) {
  const ip = getIP(request)
  const allowed = await checkRateLimit(ip, 'pix-generate', 10, 60)
  if (!allowed) {
    return Response.json({ error: 'Muitas requisições. Tente em breve.' }, { status: 429 })
  }

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

  const { txid, buyerName } = result.data

  // Amount is always derived server-side from reserved numbers
  const data = await getNumbers()
  const reserved = Object.values(data).filter(
    e => e.txid === txid && e.status === 'reserved'
  )

  if (reserved.length === 0) {
    return Response.json({ error: 'Reserva não encontrada ou expirada' }, { status: 404 })
  }

  const amount = reserved.length * PRICE_PER_NUMBER
  const description = `Rifa ${txid} - ${buyerName}`.substring(0, 72)

  const pixString = generatePixEMV({
    key: process.env.PIX_KEY!,
    merchantName: process.env.PIX_MERCHANT_NAME || 'Raiza Gabriela',
    merchantCity: process.env.PIX_MERCHANT_CITY || 'Sao Paulo',
    amount,
    txid,
    description,
  })

  const qrCode = await QRCode.toDataURL(pixString, { width: 300, margin: 2 })

  return Response.json({ pixString, qrCode, amount })
}
