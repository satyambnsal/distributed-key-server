import { NextResponse } from 'next/server'
import { ibeConfig } from '@/constants'

interface PublicConfig {
  threshold: number
  master_public_key_hex: string
  servers: string[]
}

export async function GET() {
  // Try to fetch from key servers first
  for (const server of ibeConfig.servers) {
    try {
      const response = await fetch(`${server}/config`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      })

      if (response.ok) {
        const config: PublicConfig = await response.json()
        return NextResponse.json({
          threshold: config.threshold,
          masterPublicKeyHex: config.master_public_key_hex,
          servers: config.servers,
          source: 'server',
        })
      }
    } catch {
      // Try next server
      continue
    }
  }

  // Fall back to environment variables
  if (ibeConfig.masterPublicKeyHex) {
    return NextResponse.json({
      threshold: ibeConfig.threshold,
      masterPublicKeyHex: ibeConfig.masterPublicKeyHex,
      servers: ibeConfig.servers,
      source: 'env',
    })
  }

  return NextResponse.json(
    { error: 'Configuration not available. Key servers are down and no fallback configured.' },
    { status: 503 }
  )
}
