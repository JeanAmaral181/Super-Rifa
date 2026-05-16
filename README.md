# Super Rifa

Plataforma de rifas que construí pra estudar segurança em aplicações web. Tem integração com PIX no padrão EMV do Banco Central, Redis pra lidar com reservas simultâneas sem conflito, autenticação JWT e rate limiting por IP.

Roda em produção (modo demo) em: [super-rifa.vercel.app](https://super-rifa.vercel.app)

## O que tem dentro

- **Next.js 16** com App Router — API Routes e Server Components
- **TypeScript** em tudo
- **Upstash Redis** pra estado distribuído e mutex com `SET NX`
- **JWT + bcrypt** pra autenticação do painel admin
- **Zod** pra validar todas as entradas
- **PIX/EMV** — geração de QR Code seguindo a spec do BACEN
- **Vercel** pra deploy

## Segurança implementada

- bcrypt com delay mínimo de 500ms pra dificultar timing attack
- Rate limiting por IP via Redis, janela configurável por rota
- Cookie `HttpOnly + SameSite=Strict` pro JWT do admin
- Zod em todas as bordas da API
- Mutex distribuído pra evitar condição de corrida nas reservas
- HMAC SHA-256 com `timingSafeEqual` no webhook PIX
- Idempotência via Redis pra evitar processar o mesmo evento duas vezes

## Modo demo

O PIX gera o QR Code e o payload EMV certinho, mas com uma chave fictícia — ou seja, nenhum pagamento real acontece. É só pra mostrar a implementação.

## Como rodar

```bash
npm install
cp .env.example .env
# preencha as variáveis no .env
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente

| Variável | O que é |
|---|---|
| `UPSTASH_REDIS_REST_URL` | URL do Redis no Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token do Redis no Upstash |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt da senha do painel admin |
| `JWT_SECRET` | Chave pra assinar o JWT |
| `PIX_KEY` | Chave PIX — coloque `demo` pra rodar sem pagamento real |
| `PIX_MERCHANT_NAME` | Nome que aparece no QR (máx. 25 caracteres) |
| `PIX_MERCHANT_CITY` | Cidade que aparece no QR (máx. 15 caracteres) |

## Painel admin

Acesse `/admin` e entre com a senha do `ADMIN_PASSWORD_HASH`. De lá dá pra confirmar pagamentos, liberar reservas expiradas, adicionar compras na mão e fazer o sorteio com commit-reveal pra provar que não foi manipulado.
