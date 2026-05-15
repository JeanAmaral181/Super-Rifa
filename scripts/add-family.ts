/**
 * Adiciona 500 números aleatórios como pagos pela família da Raiza e os exclui do sorteio.
 *
 * Uso: npx tsx scripts/add-family.ts
 *
 * Segurança (conforme SKILL.md):
 * - Nunca sobrescreve números já pagos — escolhe apenas disponíveis/reservados
 * - Usa withLock para evitar race condition com operações concorrentes
 * - TXID único rastreável e auditável
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Carrega .env manualmente (sem dependência de dotenv)
const envPath = resolve(__dirname, '../.env')
const envContent = readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
}

import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

const TOTAL_NUMBERS = 1600
const REDIS_KEY = 'rifa:numbers'
const EXCLUDED_KEY = 'rifa:draw:excluded'
const LOCK_KEY = 'rifa:lock'
const FAMILY_COUNT = 500

type NumberEntry = {
  status: 'reserved' | 'paid'
  name: string
  phone: string
  ts: number
  txid: string
}
type NumbersRecord = Record<string, NumberEntry>

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const lockToken = randomBytes(8).toString('hex')
  const acquired = await redis.set(LOCK_KEY, lockToken, { ex: 30, nx: true })
  if (!acquired) throw new Error('Lock ocupado — tente novamente')
  try {
    return await fn()
  } finally {
    const current = await redis.get<string>(LOCK_KEY)
    if (current === lockToken) await redis.del(LOCK_KEY)
  }
}

async function main() {
  console.log('Conectando ao Redis...')

  const raw = await redis.get<string>(REDIS_KEY)
  const data: NumbersRecord =
    !raw ? {}
    : typeof raw === 'string' ? JSON.parse(raw)
    : (raw as NumbersRecord)

  // Números já pagos — não tocamos neles
  const paidSet = new Set(
    Object.entries(data)
      .filter(([, v]) => v.status === 'paid')
      .map(([k]) => Number(k))
  )

  // Pool de disponíveis (nem pagos)
  const available: number[] = []
  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    if (!paidSet.has(i)) available.push(i)
  }

  if (available.length < FAMILY_COUNT) {
    console.error(`Apenas ${available.length} números disponíveis — menos que ${FAMILY_COUNT}`)
    process.exit(1)
  }

  // Fisher-Yates para escolha aleatória sem repetição
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[available[i], available[j]] = [available[j], available[i]]
  }
  const chosen = available.slice(0, FAMILY_COUNT).sort((a, b) => a - b)

  const txid = `FAM-${randomBytes(4).toString('hex').toUpperCase()}`
  const ts = Date.now()

  console.log(`TXID gerado: ${txid}`)
  console.log(`Números escolhidos (primeiros 20): ${chosen.slice(0, 20).join(', ')}...`)

  await withLock(async () => {
    // Re-lê dentro do lock para ter o estado mais recente
    const raw2 = await redis.get<string>(REDIS_KEY)
    const fresh: NumbersRecord =
      !raw2 ? {}
      : typeof raw2 === 'string' ? JSON.parse(raw2)
      : (raw2 as NumbersRecord)

    // Verifica novamente se nenhum dos escolhidos virou pago entre agora e o lock
    const conflicts = chosen.filter(n => fresh[String(n)]?.status === 'paid')
    if (conflicts.length > 0) {
      console.error(`Conflito: ${conflicts.length} número(s) foram pagos enquanto calculávamos.`)
      console.error('Rode o script novamente.')
      process.exit(1)
    }

    for (const n of chosen) {
      fresh[String(n)] = {
        status: 'paid',
        name: 'Família da Raiza',
        phone: '11000000000',
        ts,
        txid,
      }
    }

    await redis.set(REDIS_KEY, JSON.stringify(fresh))
    await redis.sadd(EXCLUDED_KEY, txid)
  })

  console.log(`\n✅ ${FAMILY_COUNT} números adicionados como pagos.`)
  console.log(`✅ TXID ${txid} excluído do sorteio.`)
  console.log('\nPara verificar no painel admin, acesse /admin → aba "Pagos".')
}

main().catch(err => {
  console.error('Erro:', err)
  process.exit(1)
})
