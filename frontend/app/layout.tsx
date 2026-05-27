import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'AwesomeIBE - Identity-Based Encryption',
  description: 'Encrypt data for anyone using just their email. Decryption keys distributed across multiple servers.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-canvas text-ink">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
