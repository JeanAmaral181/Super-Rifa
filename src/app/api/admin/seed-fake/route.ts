import { requireAdmin } from '@/lib/auth.server'
import { redis } from '@/lib/db'
import { randomBytes } from 'crypto'

const FAKE_BUYERS = [
  { name: 'Carlos Silva',       phone: '11987654321' },
  { name: 'Ana Souza',          phone: '21912345678' },
  { name: 'Pedro Santos',       phone: '31998765432' },
  { name: 'Maria Oliveira',     phone: '41987654321' },
  { name: 'João Costa',         phone: '51923456789' },
  { name: 'Fernanda Lima',      phone: '71987654321' },
  { name: 'Lucas Pereira',      phone: '85912345678' },
  { name: 'Juliana Rodrigues',  phone: '62987654321' },
  { name: 'Rafael Alves',       phone: '27998765432' },
  { name: 'Camila Ferreira',    phone: '48987654321' },
  { name: 'Bruno Martins',      phone: '11956781234' },
  { name: 'Larissa Gomes',      phone: '21945678901' },
  { name: 'Thiago Carvalho',    phone: '31934567890' },
  { name: 'Amanda Nascimento',  phone: '41923456789' },
  { name: 'Rodrigo Barbosa',    phone: '51912345678' },
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle(arr: number[]): number[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

export async function POST() {
  const authErr = await requireAdmin()
  if (authErr) return authErr

  // Clear all raffle data
  await Promise.all([
    redis.del('rifa:numbers'),
    redis.del('rifa:draw'),
    redis.del('rifa:draw:commitment'),
    redis.del('rifa:draw:seed'),
    redis.del('rifa:draw:excluded'),
  ])

  const allNumbers = Array.from({ length: 1600 }, (_, i) => i + 1)
  const pool = shuffle(allNumbers)

  const entries: Record<string, object> = {}
  let cursor = 0
  const now = Date.now()

  // 12 groups of paid entries (2–8 numbers each)
  for (let g = 0; g < 12; g++) {
    const buyer = FAKE_BUYERS[g % FAKE_BUYERS.length]
    const count = 2 + Math.floor(Math.random() * 7)
    const txid = randomBytes(8).toString('hex').toUpperCase()
    const ts = now - Math.floor(Math.random() * 48 * 3600 * 1000)
    for (let i = 0; i < count && cursor < pool.length; i++, cursor++) {
      entries[String(pool[cursor])] = { status: 'paid', name: buyer.name, phone: buyer.phone, ts, txid }
    }
  }

  // 5 groups of reserved entries
  for (let g = 0; g < 5; g++) {
    const buyer = pick(FAKE_BUYERS)
    const count = 1 + Math.floor(Math.random() * 4)
    const txid = randomBytes(8).toString('hex').toUpperCase()
    const ts = now - Math.floor(Math.random() * 30 * 60 * 1000)
    for (let i = 0; i < count && cursor < pool.length; i++, cursor++) {
      entries[String(pool[cursor])] = { status: 'reserved', name: buyer.name, phone: buyer.phone, ts, txid }
    }
  }

  await redis.set('rifa:numbers', JSON.stringify(entries))

  const paid = Object.values(entries).filter((e: any) => e.status === 'paid').length
  const reserved = Object.values(entries).filter((e: any) => e.status === 'reserved').length

  return Response.json({ ok: true, paid, reserved, cleared: true })
}
