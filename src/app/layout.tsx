import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Super Rifa — Participe e Ganhe!',
  description:
    'Participe da Super Rifa e concorra a prêmios incríveis! iPhone 15 128GB, iPhone 11 e premiações em dinheiro. Apenas R$ 15,00 por número.',
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
