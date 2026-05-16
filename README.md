# Super Rifa

Plataforma full-stack de rifas com geração de QR Code PIX via especificação EMV do BACEN (modo demo), estado distribuído via Redis com mutex lock, autenticação JWT e rate limiting por IP.

**Demo:** [super-rifa.vercel.app](https://super-rifa.vercel.app)

## Stack

- **Next.js 16** — App Router, Server Components, API Routes
- **TypeScript** — tipagem estrita em todas as camadas
- **Upstash Redis** — estado distribuído + mutex lock (NX)
- **JWT + bcrypt** — autenticação admin com cookie HttpOnly
- **Zod** — validação de schema em todas as fronteiras de API
- **PIX/EMV** — geração de payload seguindo a especificação BACEN
- **Vercel** — deploy contínuo

## Segurança

- `bcrypt` com delay mínimo de 500 ms — defesa contra timing attack
- Rate limiting por IP no Redis, janela configurável por rota
- Cookie `HttpOnly + SameSite=Strict` para o token JWT admin
- Validação Zod em todas as entradas de API
- Mutex distribuído (Redis `SET NX`) para reservas concorrentes
- HMAC SHA-256 com `timingSafeEqual` no webhook PIX
- Idempotência de eventos via Redis (TTL 7 dias)

## Modo Demo

A integração PIX está em modo demonstrativo — o payload EMV é gerado corretamente seguindo a especificação do BACEN, mas com uma chave fictícia. Nenhum pagamento real é processado.

## Rodando localmente

```bash
npm install
cp .env.example .env   # configure as variáveis
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `UPSTASH_REDIS_REST_URL` | URL do Redis (Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Redis (Upstash) |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt da senha admin |
| `JWT_SECRET` | Segredo para assinar o JWT |
| `PIX_KEY` | Chave PIX do recebedor (deixe `demo` para modo demonstrativo) |
| `PIX_MERCHANT_NAME` | Nome do recebedor (máx. 25 chars) |
| `PIX_MERCHANT_CITY` | Cidade do recebedor (máx. 15 chars) |

## Painel Admin

Acesse `/admin` com a senha configurada em `ADMIN_PASSWORD_HASH`.

Funcionalidades: confirmar pagamentos, liberar reservas expiradas, adicionar compras manuais e realizar sorteio com commit-reveal auditável.
