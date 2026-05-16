import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { signAdminToken } from '@/lib/auth.server'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

const schema = z.object({
  password: z.string().min(1).max(100),
})

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)))
}

export async function POST(request: NextRequest) {
  const start = Date.now()

  const ip = getIP(request)
  const allowed = await checkRateLimit(ip, 'admin-login', 5, 900)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    await delay(500 - (Date.now() - start))
    return Response.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    await delay(500 - (Date.now() - start))
    return Response.json({ error: 'Senha inválida' }, { status: 400 })
  }

  if (!allowed) {
    await delay(500 - (Date.now() - start))
    return Response.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 }
    )
  }

  const { password } = result.data
  const hash = process.env.ADMIN_PASSWORD_HASH

  if (!hash) {
    console.error('[login] ADMIN_PASSWORD_HASH não configurado')
    await delay(500 - (Date.now() - start))
    return Response.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  let valid: boolean
  try {
    valid = await bcrypt.compare(password, hash)
  } catch {
    console.error('[login] bcrypt.compare falhou — hash inválido')
    await delay(500 - (Date.now() - start))
    return Response.json({ error: 'Servidor mal configurado' }, { status: 500 })
  }

  // Always wait at least 500ms total to prevent timing attacks
  await delay(500 - (Date.now() - start))

  if (!valid) {
    return Response.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const token = signAdminToken()
  const cookieStore = await cookies()
  cookieStore.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60,
    path: '/',
  })

  return Response.json({ success: true })
}
