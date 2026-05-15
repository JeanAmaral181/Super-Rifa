import jwt, { type SignOptions } from 'jsonwebtoken'

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
