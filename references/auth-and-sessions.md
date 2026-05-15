# Autenticação e Sessões

## Stack do projeto

- **bcryptjs** — hash de senha (cost 12)
- **jsonwebtoken** — geração/verificação de JWT no Node.js (Route Handlers)
- **jose** — verificação de JWT no Edge Runtime (middleware)
- **Cookie httpOnly** — transporte do token (nunca localStorage)

## Como funciona o fluxo de autenticação

```
POST /api/auth/login
  → bcrypt.compare(password, ADMIN_PASSWORD_HASH)
  → jwt.sign({ role: 'admin' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' })
  → Set-Cookie: admin_token=...; HttpOnly; Secure; SameSite=Strict

Middleware (Edge Runtime)
  → jwtVerify(token, secret)  ← usa jose (compatível com Edge)
  → Bloqueia se token inválido/ausente
```

## Configuração do cookie

```typescript
// ✅ Como está configurado em /api/auth/login/route.ts
cookieStore.set('admin_token', token, {
  httpOnly: true,    // JS do browser NÃO pode ler — protege de XSS
  secure: process.env.NODE_ENV === 'production',  // HTTPS apenas em prod
  sameSite: 'strict',  // protege de CSRF — cookie não vai em requests cross-site
  maxAge: 8 * 60 * 60,  // 8 horas em segundos
  path: '/',
})
```

## Proteção contra timing attack

Comparações de senha são sempre executadas com tempo constante:

```typescript
// O código faz um delay mínimo de 500ms independente do resultado
// Isso impede que o atacante descubra se o usuário existe
// medindo o tempo de resposta
const start = Date.now()
const valid = await bcrypt.compare(password, hash)
await delay(500 - (Date.now() - start))
```

## Rate limiting no login

```typescript
// 5 tentativas por 15 minutos por IP — implementado em /api/auth/login
const allowed = await checkRateLimit(ip, 'admin-login', 5, 900)
```

Se atingido, o atacante precisa esperar 15 minutos. Um bruteforce de senha de 8 chars levaria séculos com esse rate limit.

## Verificação de JWT no middleware vs Route Handler

| Contexto | Biblioteca | Por quê |
|---|---|---|
| `src/middleware.ts` | `jose` | Edge Runtime não suporta Node.js APIs |
| `src/lib/auth.server.ts` | `jsonwebtoken` | Route Handlers rodam no Node.js runtime |

## O que NÃO fazer

```typescript
// ❌ JWT sem algoritmo explícito — vulnerável a alg=none attack
jwt.sign(payload, secret)  // padrão é HS256, mas seja explícito

// ✅ Sempre especifique o algoritmo
jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '8h' })

// ❌ localStorage para token — XSS pode roubar
localStorage.setItem('token', jwtToken)

// ❌ Token no query param — aparece em logs de servidor e histórico do browser
fetch('/api/admin?token=' + jwtToken)

// ❌ Verificar JWT apenas no cliente (atacante pode forjar)
if (localStorage.getItem('isAdmin') === 'true') { ... }
```

## Rotação e revogação de tokens

O projeto usa JWT stateless — não há lista de revogação. Se precisar revogar:
1. Altere `JWT_SECRET` na Vercel → todos os tokens existentes ficam inválidos
2. Para revogação granular: implementar Redis com lista de tokens revogados

## Alteração de senha admin

```bash
# 1. Gere novo hash
node -e "require('bcryptjs').hash('NOVA_SENHA_FORTE', 12).then(console.log)"

# 2. Atualize ADMIN_PASSWORD_HASH na Vercel

# 3. Altere JWT_SECRET também (invalida sessões abertas)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 4. Redeploye
```
