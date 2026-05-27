import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { ibeConfig } from '@/constants'

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { plaintext, recipientEmail } = await request.json()

    if (!plaintext || !recipientEmail) {
      return NextResponse.json(
        { error: 'plaintext and recipientEmail are required' },
        { status: 400 }
      )
    }

    // Construct the key_id for IBE (user:email format)
    const keyId = `user:${recipientEmail}`

    // Call the key server's encrypt endpoint
    const encryptServer = ibeConfig.servers[0]

    const response = await fetch(`${encryptServer}/encrypt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plaintext,
        key_id: keyId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      if (response.status === 503) {
        return NextResponse.json(
          { error: 'Key servers are not available. Please ensure the servers are running.' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: errorText || 'Encryption failed' },
        { status: response.status }
      )
    }

    const { sealed } = await response.json()

    return NextResponse.json({ sealed })
  } catch (error) {
    console.error('Encryption error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Encryption failed'

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return NextResponse.json(
        { error: 'Key servers are not available. Please ensure the servers are running.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
