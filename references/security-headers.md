# Headers de Segurança

## Status atual do projeto

Configurados em `next.config.ts` para todas as rotas via `source: '/(.*)'`.

## Headers configurados e o que fazem

### X-Frame-Options: DENY
Impede que o site seja embutido em `<iframe>`. Proteção contra clickjacking — atacante não pode sobrepor seu site em iframe transparente para enganar cliques.

### X-Content-Type-Options: nosniff
Força o browser a respeitar o `Content-Type` declarado. Sem isso, um browser pode "farejar" um arquivo JS disfarçado de imagem e executá-lo.

### Referrer-Policy: strict-origin-when-cross-origin
Ao navegar para outro site, o browser envia só a origem (ex: `https://seusite.vercel.app`), não o path completo. Evita que URLs com tokens (ex: `/reset-password?token=abc`) vazem para sites externos via Referer.

### Permissions-Policy: camera=(), microphone=(), geolocation=()
Desabilita APIs de hardware que o site não usa. Mesmo que um XSS aconteça, o atacante não consegue ligar a câmera.

### Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Força HTTPS por 2 anos. Depois do primeiro acesso HTTPS, o browser nunca mais tenta HTTP — elimina ataques de downgrade. O `preload` permite entrar na lista hardcoded dos browsers (não depende do primeiro acesso).

**Atenção:** Só funciona se o domínio já está em HTTPS. Vercel garante isso automaticamente.

### Content-Security-Policy
Diz ao browser quais origens de script/estilo/imagem são permitidas. Proteção principal contra XSS.

```
default-src 'self'        → por padrão, só carrega recursos do próprio domínio
script-src 'unsafe-inline' 'unsafe-eval'  → necessário para Next.js sem nonce
style-src  'unsafe-inline'  → necessário para CSS-in-JS e Tailwind
img-src    data: blob:      → permite QR code (data URL) e blob URLs
connect-src 'self'          → fetch() só vai para o próprio domínio
frame-ancestors 'none'      → igual ao X-Frame-Options DENY, mas via CSP
```

## Por que `unsafe-inline` e `unsafe-eval`?

Next.js injeta scripts inline para hidratação do React. Sem nonce, é necessário manter `unsafe-inline`. Para remover:
1. Configure nonce via middleware (gera nonce único por request)
2. Passe o nonce para o `<Script>` do Next.js
3. Adicione `nonce-${nonce}` ao CSP em vez de `unsafe-inline`

Isso é avançado — para este projeto de rifa, o nível atual é suficiente.

## Como testar os headers

```bash
# Com curl
curl -I https://seu-app.vercel.app | grep -E "(X-Frame|Content-Security|Strict-Transport)"

# Ferramenta online (depois de deploy)
# https://securityheaders.com/?q=https://seu-app.vercel.app
```

## Headers que o projeto NÃO precisa (mas poderia ter)

- `Cross-Origin-Opener-Policy: same-origin` — isola o contexto de browser (útil se usar SharedArrayBuffer)
- `Cross-Origin-Resource-Policy: same-origin` — impede outros sites de carregar seus recursos via `<img src="...">`
- `Cache-Control` nas rotas de API — `no-store` para dados sensíveis (o Next.js já aplica isso em Route Handlers)
