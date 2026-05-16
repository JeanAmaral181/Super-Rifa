import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jean Amaral da Silva — Web Developer & Security Researcher',
  description:
    'Portfólio de Jean Amaral da Silva. Desenvolvedor web full-stack especializado em TypeScript, Next.js, React e segurança de aplicações (OWASP, JWT, rate limiting).',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
