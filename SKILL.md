---
name: nextjs-vercel-security
description: Use this skill whenever the user is writing, reviewing, deploying, or auditing a Next.js application hosted on Vercel. Trigger on any code that touches authentication, environment variables, API routes, Server Actions, Route Handlers, database queries, user input handling, file uploads, third-party API calls, cookies, or sessions. Also trigger when the user mentions ".env", "deploy", "auth", "JWT", "OAuth", "session", "rate limit", "CORS", "CSP", "vazei chave", "vazei segredo", "leaked secret", "security audit", "pentest", "OWASP", "vulnerability", "vulnerabilidade", "injection", "XSS", "CSRF", "SSRF", "RCE", "open redirect", "IDOR", "sanitização", or asks "está seguro?" / "tem furo?" about any web code. ALWAYS use this skill before writing security-sensitive code — not after a breach. This skill is opinionated about preventing common AI-generated code mistakes: hardcoded secrets, missing input validation, predictable IDs, weak JWT signing, leaky error messages, unsafe deserialization, and unvalidated redirects.
---

# Segurança de Webapp Next.js + Vercel

Skill específica pro stack **Next.js (App Router) + Vercel free tier**. Foco em código executável, não teoria. Escrita em português pra Jean.

## Filosofia base

Três regras que guiam toda decisão. Decora isso:

1. **Server-side é a única verdade.** Validação no cliente é UX, não segurança. Qualquer pessoa abre DevTools e manda request direto pra API. Toda validação que importa acontece em Route Handlers, Server Actions, ou Middleware. Pense no cliente como um inimigo que pode mentir.

2. **Segredos têm UM ÚNICO lar: variáveis de ambiente da Vercel** (Project Settings → Environment Variables). Nunca no repositório. Nunca em código. **NUNCA com prefixo `NEXT_PUBLIC_`** a não ser que você ative e queira que aparecem no browser — esse prefixo é uma armadilha porque parece "público" no sentido de "público da web" mas significa "embutido no JS do browser e visível pra qualquer um com View Source".

3. **Tudo que vem do cliente é hostil até prova em contrário.** Headers (incluindo `Authorization`), cookies, body, query params, params de rota (`[id]`), conteúdo de upload, hostname. Tudo. Toda função que recebe input externo começa com validação.

## Quando ler qual referência

Antes de qualquer commit que toque segurança, identifique a tarefa e leia a referência correspondente em `references/`:

| O que você está fazendo | Arquivo |
|---|---|
| Configurar `.env`, lidar com segredos, achei chave commitada | `references/secrets-management.md` |
| Receber dados de form, query, body, upload de arquivo | `references/input-validation.md` |
| Login, logout, sessão, JWT, OAuth, "lembre de mim" | `references/auth-and-sessions.md` |
| Criar Route Handler (`app/api/.../route.ts`) ou Server Action | `references/api-security.md` |
| Query no banco (Prisma, Drizzle, SQL raw), `fetch` externo | `references/injection-attacks.md` |
| Configurar headers do site (CSP, HSTS, frame-options) | `references/security-headers.md` |
| Antes de deploy de produção ou pós-feature crítica | `references/self-pentest.md` |
| Achei segredo vazado ou suspeito invasão | `references/incident-response.md` |
| Aceitar código gerado por IA (incluindo o meu) | `references/ai-coding-pitfalls.md` |

Não tente segurar tudo na cabeça. Carrega a referência da tarefa atual.

## Checklist obrigatório antes de cada commit

Cada item previne uma classe inteira de problema. Não é teatro:

- [ ] `git status` não mostra nenhum `.env*` (exceto `.env.example`)
- [ ] `git diff --cached` não contém nada que pareça chave (`sk_`, `pk_`, `eyJ...`, hex de 32+ chars)
- [ ] Toda Route Handler nova valida input antes de tocar em qualquer recurso
- [ ] Nenhuma query usa template string com dado de usuário (`` `WHERE id=${userId}` ``)
- [ ] Nenhum `console.log(request)` ou `console.log(headers)` (vaza Authorization, cookies)
- [ ] Mensagens de erro pro cliente não vazam stack trace, nome de tabela, ou existência de registro
- [ ] Toda rota autenticada checa autorização (logado ≠ autorizado pra esse recurso)

Pra rodar parte disso automaticamente: ver "Setup inicial" abaixo. O resto é treino de olho.

## Setup inicial — RODE UMA VEZ NO REPO

Os scripts deste skill instalam a base de defesa. Você executa uma vez e ela protege todos os commits futuros:

```bash
# 1. Pre-commit hook que bloqueia commits com segredo (gitleaks)
bash scripts/setup-security.sh

# 2. Headers de segurança no Next config
#    Veja templates/next.config.security.js e cole no seu next.config.js

# 3. Dependabot pra updates de segurança automáticos
#    Veja templates/dependabot.yml e coloque em .github/dependabot.yml

# 4. .gitignore reforçado
#    Veja templates/gitignore.security e merge no seu .gitignore
```

Antes de rodar `setup-security.sh`, **leia o que ele faz** — não execute script de terceiros (inclusive meu) sem ler. É o próprio princípio da skill.

## Auditoria periódica (rode toda sexta-feira ou antes de deploy)

```bash
bash scripts/security-audit.sh
```

Isso roda: `npm audit`, busca de segredos no histórico do git, verifica `.env*` que escapou, lista deps desatualizadas. Tempo: ~30s.

## Reflexo de segurança em 30 segundos

Antes de escrever qualquer feature nova, responda mentalmente:

1. **Quem pode chamar isso?** Todos? Logados? Admins? Só o dono do recurso (`user_id` do JWT === `user_id` do recurso)?
2. **Qual o pior input que posso receber?** Texto de 10MB, SQL, HTML com `<script>`, path traversal (`../../etc/passwd`), URL interna (`http://169.254.169.254/` é o metadata service de cloud), JSON profundo (DoS por parsing), zip bomb num upload.
3. **Se isso falhar, o que vaza?** Erro mostra stack? Mostra que o email existe ("usuário não encontrado" vs "senha incorreta" é leak)? Timing diferente revela algo?
4. **Se 1000 req/s chegarem nesse endpoint, o que acontece?** DB explode? Custo Vercel/Postgres dispara? Auth bruteforce passa?

Se não consegue responder os 4 antes de codar, você não está pronto pra codar. Volte e pense. Esse hábito previne mais bug que qualquer ferramenta.

## Trabalhando com código gerado por IA

IAs (incluindo eu) cometem padrões de erro previsíveis. Ler `references/ai-coding-pitfalls.md` antes de aceitar código gerado é a higiene de segurança mais alto-ROI que existe hoje pra quem coda com IA. Top ofensores:

- `bcrypt` com salt rounds baixo (deve ser ≥ 12 em 2026)
- JWT com `algorithm: 'none'` ou chave hardcoded curta
- `dangerouslySetInnerHTML={{ __html: userInput }}` sem sanitização
- `fetch(userProvidedUrl)` sem validar destino (SSRF clássico)
- `redirect(req.query.next)` sem whitelist (open redirect → phishing)
- IDs sequenciais expostos (`/api/orders/123` permite enumerar — IDOR)
- Logs de objeto request inteiro vazando `Authorization: Bearer ...`
- `eval(userInput)` ou `new Function(userInput)` — RCE direto
- Concatenação de string em query SQL mesmo com ORM ("escapa, mas pra que?")

A referência tem o conserto pra cada um.

## Pensando como atacante

`references/self-pentest.md` ensina a atacar seu próprio site antes do atacante. Cobre:

- **Recon**: enumeração de rotas (sitemap, robots.txt, JS bundles), fingerprinting de stack, OSINT em commits antigos
- **Interceptação**: Burp Suite Community contra deploy preview da Vercel
- **JWT attacks**: `alg=none`, key confusion, secret bruteforce com `jwt_tool`
- **Session hijacking**: análise de cookie flags (Secure, HttpOnly, SameSite)
- **Fuzzing**: `ffuf`, `wfuzz` contra rotas pra achar admin/debug não documentado
- **Rate limit testing**: confirma que o middleware tá funcionando

**Pratique em deploy preview da Vercel, nunca em produção sem janela.** Atacar serviço que você não tem permissão é crime no Brasil (Lei 12.737/2012 — Lei Carolina Dieckmann).

## Quando responder ao usuário no dia-a-dia

Quando o usuário traz código (sem pedir review), faça uma passagem mental dos 4 reflexos de segurança. Se algum levantar bandeira, **mencione** — não é dar lição, é fazer o trabalho. Exemplo: "esse handler tá bom funcionalmente, mas falta validar que `params.id` é o próprio usuário antes de retornar — senão é IDOR". Curto. Acionável.

Quando o usuário pede explicitamente revisão de segurança, leia o código *duas vezes*:
- **1ª passagem**: o que ele tá tentando fazer? (entender contexto)
- **2ª passagem**: cada linha, perguntando "qual o input mais hostil possível aqui?"

Aponte achados em ordem de severidade (crítico → médio → estilo). Diga o que fazer, não só o que está errado.
