import { NextResponse } from 'next/server'
import { sendEncryptedDataEmail } from '@/lib/emailUtils'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { recipientEmail, encryptedPayload } = await request.json()

    if (!recipientEmail || !encryptedPayload) {
      return NextResponse.json(
        { error: 'Missing recipientEmail or encryptedPayload' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Validate encrypted payload is an object with content
    if (typeof encryptedPayload !== 'object' || Object.keys(encryptedPayload).length === 0) {
      return NextResponse.json(
        { error: 'Invalid encrypted payload' },
        { status: 400 }
      )
    }

    const senderEmail = user.email || 'Unknown sender'

    const result = await sendEncryptedDataEmail(
      recipientEmail,
      senderEmail,
      encryptedPayload
    )

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error) {
    console.error('Error sending encrypted data email:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
