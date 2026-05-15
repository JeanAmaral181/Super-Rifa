# Gerenciamento de Segredos

## Regra de ouro

Segredo no repositório = segredo comprometido. Mesmo que você delete depois, o histórico do git guarda para sempre. E o GitHub/GitLab escaneia commits em busca de chaves.

## Onde os segredos vivem

| Ambiente | Onde configurar |
|---|---|
| Produção (Vercel) | Project Settings → Environment Variables |
| Local | `.env` (nunca commitado) |
| CI/CD | Secrets do GitHub Actions / Vercel env vars |

## O que NUNCA fazer

```typescript
// ❌ NUNCA — hardcoded no código
const JWT_SECRET = 'minha-chave-secreta-123'

// ❌ NUNCA — prefixo NEXT_PUBLIC_ em segredos
// Qualquer var com esse prefixo vai para o bundle do browser
const secret = process.env.NEXT_PUBLIC_JWT_SECRET

// ❌ NUNCA — commitar .env
// (mesmo que você delete depois, o git history guarda)
```

## Como acessar segredos corretamente

```typescript
// ✅ Sempre via process.env, sem prefixo NEXT_PUBLIC_
// Só funciona no servidor (Route Handlers, Server Actions, lib/*.server.ts)
const secret = process.env.JWT_SECRET!

// ✅ Validar na inicialização, não em cada request
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET não configurado')
}
```

## Gerando segredos fortes

```bash
# JWT Secret (64 bytes = 128 chars hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Hash de senha admin (bcrypt com cost 12)
node -e "require('bcryptjs').hash('SUA_SENHA', 12).then(console.log)"

# UUID para IDs de transação
node -e "console.log(require('crypto').randomUUID())"
```

## Se um segredo vazou

1. **REVOGUE IMEDIATAMENTE** na plataforma correspondente (Upstash, GitHub, etc.)
2. Gere novo segredo
3. Atualize na Vercel (Project Settings → Environment Variables)
4. Redeploye
5. Veja `references/incident-response.md` para passos completos

## Checklist antes de commitar

```bash
# Verifica se algum segredo está no staging
git diff --cached | grep -E "(sk_|pk_|eyJ|AKIA|ghp_|[a-f0-9]{32,})"

# Se tiver gitleaks instalado (recomendado)
gitleaks protect --staged
```
