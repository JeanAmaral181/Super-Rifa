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
  // x-real-ip é injetado pelo Vercel a partir da conexão TCP — não forjável pelo cliente
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  // Vercel acrescenta o IP real ao FINAL do X-Forwarded-For, nunca ao início
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',').at(-1)!.trim()
  return 'unknown'
}
