/**
 * Webhook PIX — template para integração futura com PSP.
 *
 * Este projeto usa chave PIX pessoal com confirmação manual pelo admin.
 * Quando migrar para um PSP (Mercado Pago, Efí, Asaas, Stark Bank),
 * ative este handler e configure PIX_WEBHOOK_SECRET no .env.
 *
 * Diferenças por PSP:
 *   Mercado Pago  → header "x-signature", body é apenas notificação (buscar status na API)
 *   Efí/Gerencianet → mTLS ou JWT no header — sem HMAC simples
 *   Asaas         → header "asaas-access-token" (token fixo, não HMAC)
 *   Stark Bank    → ECDSA com chave pública publicada
 *
 * Para Mercado Pago: adapte verifySignature e adicione o fetch de confirmação no final.
 */

import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getNumbers, saveNumbers, withLock, redis, PRICE_PER_NUMBER } from '@/lib/db'

const WEBHOOK_SECRET = process.env.PIX_WEBHOOK_SECRET

// Idempotência: registra IDs de eventos já processados no Redis (TTL 7 dias)
async function markProcessed(eventId: string): Promise<boolean> {
  const key = `rifa:webhook:${eventId}`
  const set = await redis.set(key, '1', { nx: true, ex: 7 * 24 * 3600 })
  return set === 'OK' // true = novo; false = duplicata
}

function verifyHmacSignature(rawBody: string, signatureHex: string): boolean {
  if (!WEBHOOK_SECRET) return false
  const expected = createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')
  // timingSafeEqual previne timing attack — não use ===
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHex, 'hex'))
  } catch {
    return false // tamanhos diferentes
  }
}

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    // Retorna 200 para não alertar atacante que o endpoint existe mas está desativado
    return new Response(null, { status: 200 })
  }

  // 1. Ler body como TEXT — obrigatório pra HMAC bater.
  //    request.json() re-serializa internamente e pode mudar whitespace.
  const rawBody = await request.text()

  // 2. Assinatura — nome do header varia por PSP. Ajuste aqui.
  const signature = request.headers.get('x-signature') // Mercado Pago
  // const signature = request.headers.get('x-webhook-signature') // outros

  if (!signature || !verifyHmacSignature(rawBody, signature)) {
    console.warn('[webhook-pix] invalid signature', {
      ip: request.headers.get('x-forwarded-for'),
    })
    return new Response('Invalid signature', { status: 401 })
  }

  // 3. Parse — só após validar assinatura
  let event: {
    id: string
    type: string
    data?: { id: string }
    payment?: { status: string; externalReference: string; amount: number }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // 4. Idempotência — ignora duplicatas (retry do provider ou replay de atacante)
  const isNew = await markProcessed(event.id)
  if (!isNew) {
    return Response.json({ ok: true, duplicate: true })
  }

  // 5. Processar pagamento confirmado
  //    Mercado Pago: event.type === 'payment' e event.data.id é o paymentId.
  //    Você precisa buscar o status na API deles — o body aqui é só notificação.
  //    Para outros PSPs o status pode vir direto no body.
  if (event.type === 'payment' && event.data?.id) {
    // Para Mercado Pago: busque o status real na API antes de confirmar
    // const payment = await fetchMercadoPagoPayment(event.data.id)
    // if (payment.status !== 'approved') return Response.json({ ok: true })

    const txid = event.payment?.externalReference
    if (!txid) return Response.json({ ok: true })

    const expectedAmount = event.payment?.amount

    await withLock(async () => {
      const data = await getNumbers()

      const reservedForTxid = Object.values(data).filter(
        e => e.txid === txid && e.status === 'reserved'
      )

      if (reservedForTxid.length === 0) return

      const expectedTotal = reservedForTxid.length * PRICE_PER_NUMBER
      if (expectedAmount !== undefined && Math.abs(expectedAmount - expectedTotal) > 0.01) {
        console.warn('[webhook-pix] amount mismatch', { txid, expectedAmount, expectedTotal })
        return
      }

      for (const [key, entry] of Object.entries(data)) {
        if (entry.txid === txid && entry.status === 'reserved') {
          data[key] = { ...entry, status: 'paid' }
        }
      }
      await saveNumbers(data)
    })
  }

  return Response.json({ ok: true })
}
