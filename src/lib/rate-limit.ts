import { redis } from './db'

export async function checkRateLimit(
  ip: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `rl:${action}:${ip}`
  // SET NX garante que a chave sempre tem TTL antes do INCR,
  // evitando chaves eternas em caso de crash entre INCR e EXPIRE.
  await redis.set(key, 0, { ex: windowSeconds, nx: true })
  const count = await redis.incr(key)
  return count <= limit
}

export function getIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}
