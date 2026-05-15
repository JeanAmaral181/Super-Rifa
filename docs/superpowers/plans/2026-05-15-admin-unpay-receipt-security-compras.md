# Admin Unpay + Receipt + Security + Minhas Compras

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar remoção de pagamento pelo admin, endpoint público de comprovante por txid, corrigir inseguranças identificadas pelo SKILL.md, e criar aba pública "Minhas Compras" com localStorage + verificação ao vivo.

**Architecture:** Dois novos endpoints REST (admin/unpay, numbers/receipt), correções de segurança em três rotas existentes, e extensão do page.tsx público com seção de histórico de compras persistido em localStorage.

**Tech Stack:** Next.js 16 App Router, Upstash Redis, Zod, bcryptjs, jose, localStorage

---

## Arquivos

### Criados
- `src/app/api/admin/unpay/route.ts` — DELETE paid entries por txid (admin)
- `src/app/api/numbers/receipt/route.ts` — GET comprovante público por txid

### Modificados
- `src/app/api/numbers/status/route.ts` — min 3 chars + filtrar expirados
- `src/app/api/pix/generate/route.ts` — regex mais estrita no txid
- `src/app/api/admin/confirm/route.ts` — spread explícito em vez de mutação direta
- `src/app/admin/page.tsx` — botão "Desfazer pagamento" para entradas pagas
- `src/app/page.tsx` — seção "Minhas Compras" com localStorage + status ao vivo

---

## Task 1: endpoint admin/unpay

**Files:**
- Create: `src/app/api/admin/unpay/route.ts`

- [ ] Criar rota DELETE que remove entradas pagas (ou reservadas) de um txid e limpa o excluded set

```ts
// src/app/api/admin/unpay/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getNumbers, saveNumbers, withLock, redis } from '@/lib/db'

const schema = z.object({
  txid: z.string().min(1).max(50),
})

const EXCLUDED_KEY = 'rifa:draw:excluded'

export async function DELETE(request: NextRequest) {
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
```

---

## Task 2: endpoint numbers/receipt

**Files:**
- Create: `src/app/api/numbers/receipt/route.ts`

- [ ] Criar rota GET pública para comprovante por txid

```ts
// src/app/api/numbers/receipt/route.ts
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
```

---

## Task 3: Security fixes

- [ ] `numbers/status` — min 3 chars + filtrar expirados
- [ ] `pix/generate` — regex txid
- [ ] `admin/confirm` — spread explícito

---

## Task 4: Admin UI — botão Desfazer

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] Adicionar `handleUnpay(txid)` e botão ↩ para entradas pagas

---

## Task 5: Public UI — Minhas Compras

**Files:**
- Modify: `src/app/page.tsx`

- [ ] Seção "Minhas Compras" com localStorage + verificação via /api/numbers/receipt
