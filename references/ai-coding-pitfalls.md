# Armadilhas de Código Gerado por IA

IAs (incluindo Claude) cometem padrões de erro previsíveis. Este arquivo documenta os que já apareceram ou podem aparecer neste projeto.

## Top erros e como corrigi-los neste projeto

### 1. bcrypt com salt rounds baixo
```typescript
// ❌ O que IA às vezes gera (cost 10 é o padrão de exemplos antigos)
bcrypt.hash(password, 10)

// ✅ O projeto usa cost 12 (necessário em 2026 por aumento de capacidade de GPU)
bcrypt.hash(password, 12)
```

### 2. JWT sem algoritmo explícito
```typescript
// ❌ O que IA gera — vulnerável a "alg:none" se a biblioteca aceitar
jwt.sign(payload, secret)

// ✅ Explícito — o projeto corrigiu isso
jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '8h' })
```

### 3. JWT com `jsonwebtoken` no middleware (Edge Runtime)
```typescript
// ❌ IA frequentemente gera isso — jsonwebtoken não funciona no Edge Runtime
import jwt from 'jsonwebtoken'
export default async function middleware(req) {
  jwt.verify(token, secret)  // throws: "crypto" is not defined
}

// ✅ jose para Edge Runtime — o projeto usa isso em src/middleware.ts
import { jwtVerify } from 'jose'
const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
```

### 4. Middleware com nome errado (bug que existiu neste projeto!)
```typescript
// ❌ IA pode gerar arquivo proxy.ts ou auth-middleware.ts
// Next.js ignora — o arquivo DEVE se chamar src/middleware.ts
// com export default function middleware()

// ✅ src/middleware.ts com export default
export default async function middleware(request: NextRequest) { ... }
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }
```

### 5. Rate limit em memória — não funciona em produção serverless
```typescript
// ❌ O que IA gera frequentemente — Map em módulo é resetado a cada cold start
const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(req, limit, windowMs) {
  const ip = '...'
  const entry = store.get(ip)  // sempre vazio após cold start
  // ... rate limit nunca funciona de verdade
}

// ✅ O projeto usa Redis distribuído — persiste entre instâncias e cold starts
await redis.incr(`rl:${action}:${ip}`)
await redis.expire(`rl:${action}:${ip}`, windowSeconds)
```

### 6. `dangerouslySetInnerHTML` com dado de usuário
```typescript
// ❌ XSS stored — IA às vezes gera isso para "renderizar HTML formatado"
<div dangerouslySetInnerHTML={{ __html: entry.name }} />

// ✅ React escapa automaticamente em JSX normal
<div>{entry.name}</div>
```

### 7. `fetch(userProvidedUrl)` sem validação (SSRF)
```typescript
// ❌ SSRF — IA gera isso em features de "webhook" ou "preview de link"
const url = body.callbackUrl
await fetch(url)  // atacante pode apontar para http://169.254.169.254/

// ✅ Whitelist de domínios
const parsed = new URL(body.callbackUrl)
if (!['api.meusite.com'].includes(parsed.hostname)) throw new Error('URL inválida')
```

### 8. IDs sequenciais em rotas (IDOR)
```typescript
// ❌ IA gera isso naturalmente — expõe que existem orders 1, 2, 3... e permite enumeração
app.get('/api/orders/:id', ...)  // GET /api/orders/42 funciona
// Atacante testa 1, 2, 3... e vê ordens de outros usuários

// ✅ O projeto usa IDs opacos gerados com crypto
const txid = randomBytes(8).toString('hex').toUpperCase()
// Impossível de enumerar — 2^64 possibilidades
```

### 9. Logs de objeto request inteiro
```typescript
// ❌ IA adiciona logs para debug — vaza Authorization, cookies, dados do usuário
console.log('Request:', request)
console.log('Headers:', request.headers)

// ✅ Log apenas o que é necessário para debug
console.error('[pix-generate] Erro ao gerar PIX:', err.message)
```

### 10. Erro de redirect sem validação (Open Redirect)
```typescript
// ❌ IA usa o parâmetro ?next= de forma naive
const next = searchParams.get('next')
redirect(next)  // atacante pode usar: /login?next=https://site-malicioso.com

// ✅ Apenas caminhos internos — sem URLs externas
const next = searchParams.get('next') ?? '/'
const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
redirect(safeNext)
```

## Como revisar código gerado por IA

1. Procure pelos padrões acima antes de aceitar
2. Rode `bash scripts/security-audit.sh` após cada feature nova
3. Verifique se novos Route Handlers têm rate limit + validação Zod
4. Se IA gerou `Map()` em módulo para persistir estado — suspeite imediatamente
5. Se IA usou `console.log(request)` — remova antes de commitar
