import jwt, { type SignOptions } from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET!

export function signAdminToken(): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn']
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn, algorithm: 'HS256' })
}

export function verifyAdminToken(token: string): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload
    return decoded.role === 'admin'
  } catch {
    return false
  }
}

/** Lê o cookie admin_token e retorna Response 401 se inválido, null se ok. */
export async function requireAdmin(): Promise<Response | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token || !verifyAdminToken(token)) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return null
}
