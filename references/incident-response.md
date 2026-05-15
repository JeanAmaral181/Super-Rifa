# Resposta a Incidentes

## Se você acha que foi invadido ou um segredo vazou

### Passo 1 — Contenção imediata (primeiros 15 minutos)

**Se a chave PIX vazou:**
1. Acesse o app do banco e bloqueie a chave PIX imediatamente
2. Mude a chave PIX para uma diferente
3. Atualize `PIX_KEY` na Vercel

**Se o JWT_SECRET ou ADMIN_PASSWORD_HASH vazou:**
1. Vercel → Project Settings → Environment Variables
2. Altere `JWT_SECRET` (invalida todas as sessões admin abertas)
3. Gere novo hash de senha: `node -e "require('bcryptjs').hash('NOVA_SENHA',12).then(console.log)"`
4. Atualize `ADMIN_PASSWORD_HASH`
5. Redeploye imediatamente

**Se as credenciais Upstash vazaram:**
1. Acesse console.upstash.com
2. Vá em Database → Reset Token
3. Atualize `UPSTASH_REDIS_REST_TOKEN` na Vercel
4. Redeploye

### Passo 2 — Avaliação de dano (após contenção)

```bash
# Verifique os logs da Vercel para atividade suspeita
# Vercel Dashboard → seu projeto → Deployments → Functions → Logs

# Verifique se há números "pagos" suspeitos que não deveriam estar pagos
# Painel admin → aba "Pagos" — veja timestamps fora do horário normal

# Verifique o Redis direto
# console.upstash.com → Data Browser → rifa:numbers
```

### Passo 3 — Remover segredo do histórico git (se commitado)

```bash
# NUNCA force-push em repo público — notifique colaboradores antes

# Opção 1: git-filter-repo (recomendado)
pip install git-filter-repo
git filter-repo --path .env --invert-paths

# Opção 2: BFG Repo Cleaner (mais simples)
# Baixe bfg.jar de rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease origin main

# IMPORTANTE: após isso, force todos os colaboradores a fazer fresh clone
# O histórico local deles ainda tem o segredo
```

### Passo 4 — Notificação

Se dados de compradores foram expostos (nome, telefone):
- Avise os compradores afetados via WhatsApp
- Explique o que aconteceu e o que foi feito para corrigir

### Passo 5 — Post-mortem

Depois de resolver:
1. O que falhou? (segredo commitado? variável NEXT_PUBLIC_? código vulnerável?)
2. Qual a timeline? (quando aconteceu vs quando foi descoberto)
3. O que muda no processo para não repetir? (hook pré-commit, review, etc.)

## Indicadores de comprometimento (IoCs)

Monitore nos logs da Vercel:
- Muitas requisições 429 (brute force no login)
- Requisições para `/api/admin/*` sem cookie (tentativa de bypass)
- Requests com headers incomuns (`Authorization: Bearer ...` em rotas que não usam Bearer)
- Picos de tráfego na madrugada
- Payloads JSON muito grandes (DoS)

## Contatos de emergência

- **Vercel Support:** vercel.com/support
- **Upstash Support:** upstash.com/docs → Community/Discord
- **GitHub Security:** github.com/security (para segredos commitados em repos públicos)
