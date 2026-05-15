# Validação de Input

## Princípio

Tudo que vem do cliente é hostil até prova em contrário. Headers, cookies, body, query params, path params — tudo. Valide no servidor antes de tocar em qualquer recurso.

## Padrão do projeto: Zod

Todos os Route Handlers do projeto usam Zod para validação estruturada.

```typescript
// ✅ Padrão correto — usado no projeto
import { z } from 'zod'

const schema = z.object({
  numbers: z.array(z.number().int().min(1).max(1000)).min(1).max(50),
  name:    z.string().min(2).max(100).trim(),
  phone:   z.string().min(10).max(20).regex(/^\d+$/),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    // Não vaze detalhes do schema em produção
    return Response.json({ error: result.error.issues[0].message }, { status: 400 })
  }

  const { numbers, name, phone } = result.data // tipos garantidos
}
```

## O que validar em cada tipo de input

### String de usuário (nomes, mensagens)
```typescript
z.string()
  .min(2)         // rejeita strings vazias com aparência de preenchidas
  .max(100)       // limita tamanho para evitar DoS por texto gigante
  .trim()         // remove whitespace antes/depois
```

### Números de rifa (IDs de recurso)
```typescript
z.number().int().min(1).max(1000)
// Nunca confie em Math.floor(parseFloat(str)) — Zod faz isso com segurança
```

### Phone / WhatsApp
```typescript
z.string().min(10).max(20).regex(/^\d+$/)
// Rejeita strings que não são só dígitos — evita injeção via formatação
```

### TXID (identificadores de transação)
```typescript
z.string().min(1).max(50)
// Se gerado pelo servidor, nunca confie no que o cliente manda como TXID
// O projeto gera TXID com randomBytes(8).toString('hex').toUpperCase()
```

## Inputs especialmente perigosos

### Path params (`params.id`)
```typescript
// ❌ IDOR se não validar que o recurso pertence ao usuário logado
const { id } = params  // pode ser qualquer coisa

// ✅ Sempre valide ownership
const entry = await getEntry(id)
if (!entry || entry.userId !== session.userId) {
  return Response.json({ error: 'Not found' }, { status: 404 })
}
// 404 (não 403) — não confirma existência do recurso para outros usuários
```

### Query params
```typescript
// ❌ ReDoS — regex catastrófico com input longo
const q = searchParams.get('q')
if (/^(a+)+$/.test(q)) { ... }  // trava com input tipo 'aaaaaaaaaa!'

// ✅ Limite o tamanho antes de qualquer regex
const q = searchParams.get('q')?.substring(0, 100)
```

### Uploads de arquivo
```typescript
// Valide: tamanho máximo, tipo MIME (no servidor, não via extensão)
// O projeto não tem uploads — se adicionar, veja OWASP File Upload Cheat Sheet
```

## Anti-patterns para não repetir

```typescript
// ❌ Aceita qualquer coisa que parseie como number
const n = parseInt(params.number)  // parseInt('1; DROP TABLE...') = 1

// ❌ Constrói query com dado de usuário (SQL injection)
const q = `WHERE name = '${name}'`

// ❌ Renderiza HTML de usuário sem sanitização (XSS)
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ❌ Usa eval ou Function com dado do usuário (RCE)
eval(userCode)
```
