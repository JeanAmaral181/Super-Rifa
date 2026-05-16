import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'
import { EXPIRE_MS, TOTAL_NUMBERS, PRICE_PER_NUMBER } from './constants'

export { EXPIRE_MS, TOTAL_NUMBERS, PRICE_PER_NUMBER }

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export type NumberEntry = {
  status: 'reserved' | 'paid'
  name: string
  phone: string
  ts: number
  txid: string
}

export type NumbersRecord = Record<string, NumberEntry>

const REDIS_KEY = 'rifa:numbers'
const LOCK_KEY = 'rifa:lock'

export async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const lockToken = randomBytes(8).toString('hex')
  const acquired = await redis.set(LOCK_KEY, lockToken, { ex: 10, nx: true })
  if (!acquired) {
    throw new Error('Servidor ocupado, tente novamente em instantes')
  }
  try {
    return await fn()
  } finally {
    const current = await redis.get<string>(LOCK_KEY)
    if (current === lockToken) await redis.del(LOCK_KEY)
  }
}

export async function getNumbers(): Promise<NumbersRecord> {
  const raw = await redis.get<string>(REDIS_KEY)
  if (!raw) return {}
  if (typeof raw !== 'string') return raw as NumbersRecord
  try {
    return JSON.parse(raw)
  } catch {
    console.error('[db] getNumbers: JSON inválido no Redis — retornando vazio')
    return {}
  }
}

export async function saveNumbers(data: NumbersRecord): Promise<void> {
  await redis.set(REDIS_KEY, JSON.stringify(data))
}

export async function autoExpire(data: NumbersRecord): Promise<NumbersRecord> {
  const now = Date.now()
  let changed = false
  for (const key of Object.keys(data)) {
    const entry = data[key]
    if (entry.status === 'reserved' && now - entry.ts > EXPIRE_MS) {
      delete data[key]
      changed = true
    }
  }
  if (changed) await saveNumbers(data)
  return data
}

// ── Exclusão do sorteio ───────────────────────────────────────────────────────
// Txids neste set são exibidos como pagos na grade mas NÃO entram no sorteio.
// Usado para números da família que compraram só para ajudar.

const EXCLUDED_KEY = 'rifa:draw:excluded'

export async function getExcludedTxids(): Promise<string[]> {
  const members = await redis.smembers(EXCLUDED_KEY)
  return members as string[]
}

export async function setTxidExclusion(txid: string, exclude: boolean): Promise<void> {
  if (exclude) {
    await redis.sadd(EXCLUDED_KEY, txid)
  } else {
    await redis.srem(EXCLUDED_KEY, txid)
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────

export type DrawResult = {
  winnerNumber: number
  winnerName: string
  winnerPhone: string
  winnerTxid: string
  totalPaid: number
  winnerIndex: number
  drawnAt: number
  secretSeed: string       // revealed after draw — use to verify fairness
  seedCommitment: string   // SHA256(secretSeed) — was published before closing sales
  ticketSnapshot: number[] // sorted paid numbers at draw time — reconstruct winnerIndex
  usedCommitReveal: boolean
}

export type DrawCommitment = {
  seedCommitment: string
  committedAt: number
}

const DRAW_KEY = 'rifa:draw'
const COMMITMENT_KEY = 'rifa:draw:commitment'
const SEED_KEY = 'rifa:draw:seed'   // secretSeed kept server-side until reveal

export async function getDrawResult(): Promise<DrawResult | null> {
  return redis.get<DrawResult>(DRAW_KEY)
}

export async function saveDrawResult(result: DrawResult): Promise<void> {
  await redis.set(DRAW_KEY, JSON.stringify(result))
}

export async function getDrawCommitment(): Promise<DrawCommitment | null> {
  return redis.get<DrawCommitment>(COMMITMENT_KEY)
}

export async function saveDrawCommitment(c: DrawCommitment): Promise<void> {
  await redis.set(COMMITMENT_KEY, JSON.stringify(c))
}

export async function getDrawSeed(): Promise<string | null> {
  return redis.get<string>(SEED_KEY)
}

export async function saveDrawSeed(seed: string): Promise<void> {
  await redis.set(SEED_KEY, seed)
}

export async function deleteDrawSeed(): Promise<void> {
  await redis.del(SEED_KEY)
}

export async function resetDraw(): Promise<void> {
  await Promise.all([
    redis.del(DRAW_KEY),
    redis.del(COMMITMENT_KEY),
    redis.del(SEED_KEY),
  ])
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function computeStats(data: NumbersRecord) {
  const now = Date.now()
  let reserved = 0
  let paid = 0
  let expired = 0
  let revenue = 0
  for (const entry of Object.values(data)) {
    if (entry.status === 'reserved') {
      if (now - entry.ts > EXPIRE_MS) {
        expired++
      } else {
        reserved++
      }
    } else if (entry.status === 'paid') {
      paid++
      revenue += PRICE_PER_NUMBER
    }
  }
  const available = TOTAL_NUMBERS - reserved - paid
  return { available, reserved, paid, expired, revenue }
}
