import { randomBytes, createHash } from 'node:crypto'
import { getDrawResult, getDrawCommitment, saveDrawCommitment, saveDrawSeed } from '@/lib/db'
import { requireAdmin } from '@/lib/auth.server'

// POST — fase 1 do commit-reveal: gera seed e publica o hash (commitment).
// Publique o seedCommitment no Instagram/site antes de encerrar as vendas.
// Isso prova que o vencedor não foi escolhido depois de saber quem comprou.
export async function POST() {
  const authErr = await requireAdmin()
  if (authErr) return authErr
  if (await getDrawResult()) {
    return Response.json({ error: 'Sorteio já realizado — não é possível gerar novo compromisso' }, { status: 409 })
  }

  if (await getDrawCommitment()) {
    return Response.json({ error: 'Compromisso já gerado — use o seedCommitment existente' }, { status: 409 })
  }

  const secretSeed = randomBytes(32).toString('hex')
  const seedCommitment = createHash('sha256').update(secretSeed).digest('hex')
  const committedAt = Date.now()

  // Salva seed e commitment separados:
  // - seed fica server-side (não é retornada aqui)
  // - commitment é o que o admin publica publicamente
  await Promise.all([
    saveDrawSeed(secretSeed),
    saveDrawCommitment({ seedCommitment, committedAt }),
  ])

  return Response.json({
    seedCommitment,
    committedAt,
    instructions: [
      'Publique o seedCommitment abaixo antes de encerrar as vendas.',
      'Após encerrar, faça POST em /api/admin/draw para realizar o sorteio.',
      'O secretSeed será revelado no resultado — qualquer um pode verificar: SHA256(secretSeed) deve bater com este seedCommitment.',
    ],
  })
}
