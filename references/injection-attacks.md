# Ataques de Injeção

## Contexto deste projeto

O projeto usa Redis (sem SQL) e não tem queries com ORM — as operações são get/set de objetos JSON. Isso elimina SQL injection, mas os padrões abaixo são relevantes se o projeto crescer.

## SQL Injection

Não aplicável diretamente (projeto usa Redis via SDK), mas o padrão mental é importante:

```typescript
// ❌ Template string com dado de usuário — SQL injection clássico
const q = `SELECT * FROM numbers WHERE name = '${name}'`

// ✅ Parâmetro posicional (se usar Postgres/MySQL no futuro)
const q = db.query('SELECT * FROM numbers WHERE name = $1', [name])

// ✅ ORM com Zod (Drizzle, Prisma) — query builder tipado, não concatena string
const result = await db.select().from(numbers).where(eq(numbers.name, name))
```

## NoSQL Injection (Redis)

O projeto usa `redis.get(key)` e `redis.set(key, value)`. As chaves são construídas internamente (nunca com input de usuário direto):

```typescript
// ✅ Chave hardcoded — sem input de usuário na chave Redis
const REDIS_KEY = 'rifa:numbers'
await redis.get(REDIS_KEY)

// ✅ Chave de rate limit — inclui IP mas o IP já vem sanitizado do getIP()
const key = `rl:${action}:${ip}`

// ❌ Se algum dia construir chave com input de usuário diretamente:
const key = `user:${req.query.userId}`  // perigoso se userId = '../admin'
// Use sempre IDs validados/tipados pelo Zod
```

## XSS (Cross-Site Scripting)

O projeto renderiza dados do Redis no frontend (nomes de compradores no painel admin). O React escapa automaticamente conteúdo em JSX, mas há pontos de atenção:

```typescript
// ✅ React escapa automaticamente — seguro
<td>{entry.name}</td>

// ❌ Perigoso — renderiza HTML bruto sem escape
<td dangerouslySetInnerHTML={{ __html: entry.name }} />

// ❌ No admin/page.tsx há uma função esc() que usa innerHTML:
function esc(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML  // isso é correto, mas se esc() for usada em dangerouslySetInnerHTML é perigoso
}
// Prefira sempre interpolação JSX normal ao invés de esc()
```

## SSRF (Server-Side Request Forgery)

Relevante se o projeto fizer `fetch()` para URLs fornecidas pelo usuário:

```typescript
// ❌ SSRF — atacante pode apontar para serviços internos
const url = req.body.webhookUrl  // input do usuário
await fetch(url)  // pode alcançar http://169.254.169.254/ (metadata AWS)

// ✅ Whitelist de domínios permitidos
const ALLOWED_HOSTS = ['api.exemplo.com', 'webhook.exemplo.com']
const url = new URL(req.body.webhookUrl)
if (!ALLOWED_HOSTS.includes(url.hostname)) {
  return Response.json({ error: 'URL não permitida' }, { status: 400 })
}
```

O projeto atual não faz fetch para URLs do usuário — apenas para Upstash (URL hardcoded em env var).

## Command Injection

Não aplicável — o projeto não executa comandos shell. Mas se algum dia usar `exec()` ou `spawn()` com dado de usuário:

```typescript
// ❌ Command injection
exec(`convert ${userFilename} output.png`)  // userFilename = '; rm -rf /'

// ✅ Array de argumentos — nunca vai para shell
spawn('convert', [userFilename, 'output.png'])
```

## Path Traversal

Não aplicável diretamente (projeto não lê arquivos com path de usuário). Se adicionar feature de upload:

```typescript
// ❌ Path traversal — userFilename = '../../.env'
const filePath = path.join('uploads/', userFilename)

// ✅ Valide que o path resultante está dentro do diretório permitido
const filePath = path.join('uploads/', path.basename(userFilename))
const resolvedPath = path.resolve(filePath)
if (!resolvedPath.startsWith(path.resolve('uploads/'))) {
  throw new Error('Path inválido')
}
```
