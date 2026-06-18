import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Location Advisor',
  description: 'AI-powered travel concierge',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#fff8f6" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="min-h-screen max-w-md mx-auto">
        {children}
      </body>
    </html>
  )
}
