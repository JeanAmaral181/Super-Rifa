# Segurança de Route Handlers

## Checklist para cada Route Handler novo

- [ ] Rate limiting antes de qualquer lógica
- [ ] Validação de input com Zod antes de tocar recursos
- [ ] Autenticação verificada (middleware cobre `/api/admin/*` automaticamente)
- [ ] Mensagens de erro não vazam stack trace nem nomes de tabela
- [ ] Nenhum `console.log` de objetos request/headers

## Anatomia de um Route Handler seguro

```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getIP } from '@/lib/rate-limit'

const schema = z.object({
  // defina campos esperados com limites claros
})

export async function POST(request: NextRequest) {
  // 1. Rate limit — sempre primeiro
  const ip = getIP(request)
  const allowed = await checkRateLimit(ip, 'minha-action', 10, 60)
  if (!allowed) {
    return Response.json({ error: 'Muitas requisições.' }, { status: 429 })
  }

  // 2. Parse do body — sempre com try/catch
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Requisição inválida' }, { status: 400 })
  }

  // 3. Validação com Zod
  const result = schema.safeParse(body)
  if (!result.success) {
    return Response.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  // 4. Lógica de negócio — apenas com dados validados
  const { ... } = result.data

  try {
    // ... operações
    return Response.json({ success: true })
  } catch (err) {
    // 5. Erro genérico — não vaze detalhes internos
    console.error('[minha-action]', err)  // log no servidor está OK
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

## Rate limiting do projeto

O projeto usa Redis distribuído (`src/lib/rate-limit.ts`) — funciona em múltiplas instâncias Vercel, ao contrário de Map em memória.

```typescript
// Parâmetros: ip, action, limit, windowSeconds
await checkRateLimit(ip, 'numbers-reserve', 15, 60)   // 15 req/min
await checkRateLimit(ip, 'admin-login',      5, 900)  // 5 tentativas/15min
await checkRateLimit(ip, 'pix-generate',    10, 60)   // 10 req/min
```

## Rotas admin — proteção por middleware

As rotas em `/api/admin/*` são protegidas pelo middleware automaticamente. Não é necessário verificar JWT dentro de cada Route Handler admin — o middleware rejeita a request antes de chegar ao handler.

**Mas:** isso significa que se o middleware falhar (bug, deploy), as rotas ficam abertas. Por segurança em profundidade, considere adicionar verificação dupla em operações destrutivas:

```typescript
// Defesa em profundidade para operações críticas (ex: confirmar pagamento)
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/auth.server'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  if (!token || !verifyAdminToken(token)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... resto da lógica
}
```

## Headers de resposta

O `next.config.ts` já aplica CSP e outros headers de segurança em todas as rotas. Não é necessário adicionar manualmente em cada Route Handler.

## CORS

Vercel não expõe rotas de API para outras origens por padrão — o cookie `SameSite=Strict` também protege. Se precisar de CORS no futuro (API pública), configure explicitamente só as origens necessárias.
