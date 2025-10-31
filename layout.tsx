import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Runwell Ideas Studio',
  description: 'PWA for idé-generering til SoMe basert på maler',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  )
}
