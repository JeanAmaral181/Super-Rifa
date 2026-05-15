/**
 * Template de headers de segurança para Next.js (App Router)
 * Cole o array `securityHeaders` no seu next.config.ts/js
 * Referência: references/security-headers.md
 */

const securityHeaders = [
  // Impede que o site seja embutido em iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },

  // Impede MIME sniffing — browser usa o Content-Type declarado
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Controla quanta info o Referer expõe ao navegar para outros sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Desabilita APIs de hardware desnecessárias
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

  // Força HTTPS por 2 anos (ative só em produção com HTTPS real)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

  // Content Security Policy — ajuste conforme CDNs/fonts que você usa
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-inline' e 'unsafe-eval' são necessários para Next.js sem nonce.
      // Para produção hardened: implemente nonce via middleware e remova unsafe-*
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

// Exemplo de uso no next.config.ts:
//
// const nextConfig: NextConfig = {
//   headers: async () => [{
//     source: '/(.*)',
//     headers: securityHeaders,
//   }],
// }

module.exports = { securityHeaders }
