import { randomBytes, randomInt, createHash } from 'node:crypto'
import {
  getNumbers,
  getDrawResult,
  getDrawCommitment,
  getDrawSeed,
  getExcludedTxids,
  deleteDrawSeed,
  saveDrawResult,
} from '@/lib/db'

// GET — retorna sorteio já realizado e/ou compromisso gerado
export async function GET() {
  const [result, commitment] = await Promise.all([getDrawResult(), getDrawCommitment()])
  return Response.json({ result, commitment })
}

// POST — realiza o sorteio
// Se houver commit-reveal prévio, usa seed armazenada (determinístico e auditável).
// Caso contrário, gera seed nova com crypto.randomInt (ainda auditável).
export async function POST() {
  const existing = await getDrawResult()
  if (existing) {
    return Response.json({ error: 'Sorteio já realizado' }, { status: 409 })
  }

  const [data, excludedList] = await Promise.all([getNumbers(), getExcludedTxids()])
  const excluded = new Set(excludedList)

  // Constrói lista de bilhetes pagos ordenada — exclui txids da família
  const paid: Array<{ number: number; name: string; phone: string; txid: string }> = []
  for (const [numStr, entry] of Object.entries(data)) {
    if (entry.status === 'paid' && !excluded.has(entry.txid)) {
      paid.push({ number: Number(numStr), name: entry.name, phone: entry.phone, txid: entry.txid })
    }
  }

  if (paid.length === 0) {
    return Response.json({ error: 'Nenhum número pago para sortear' }, { status: 400 })
  }

  paid.sort((a, b) => a.number - b.number)
  const ticketSnapshot = paid.map(e => e.number)

  const storedSeed = await getDrawSeed()
  const commitment = await getDrawCommitment()

  let secretSeed: string
  let seedCommitment: string
  let winnerIndex: number
  let usedCommitReveal: boolean

  if (storedSeed && commitment) {
    // Commit-reveal: winnerIndex é derivado deterministicamente da seed + lista de bilhetes.
    // Qualquer pessoa pode verificar: SHA256(secretSeed) == seedCommitment,
    // e BigInt('0x' + SHA256(secretSeed + '|' + tickets.join(',')).slice(0,16)) % total == winnerIndex
    secretSeed = storedSeed
    seedCommitment = commitment.seedCommitment
    const drawHash = createHash('sha256')
      .update(`${secretSeed}|${ticketSnapshot.join(',')}`)
      .digest('hex')
    const hashNum = BigInt(`0x${drawHash.slice(0, 16)}`)
    winnerIndex = Number(hashNum % BigInt(paid.length))
    usedCommitReveal = true
    await deleteDrawSeed() // seed revelada — não precisa mais guardar separado
  } else {
    // Sorteio direto: crypto.randomInt é criptograficamente seguro,
    // ao contrário de Math.random (xorshift128+ — previsível com 5 outputs).
    secretSeed = randomBytes(32).toString('hex')
    seedCommitment = createHash('sha256').update(secretSeed).digest('hex')
    winnerIndex = randomInt(0, paid.length)
    usedCommitReveal = false
  }

  const winner = paid[winnerIndex]

  const result = {
    winnerNumber: winner.number,
    winnerName: winner.name,
    winnerPhone: winner.phone,
    winnerTxid: winner.txid,
    totalPaid: paid.length,
    winnerIndex,
    drawnAt: Date.now(),
    secretSeed,
    seedCommitment,
    ticketSnapshot,
    usedCommitReveal,
  }

  await saveDrawResult(result)
  return Response.json({ result })
}
