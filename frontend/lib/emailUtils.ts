import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { APP_URL, EMAIL_FROM_ADDRESS } from '@/constants'

const sesClient = new SESClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.AWS_REGION || 'us-east-1',
})

const BRAND_COLOR = '#aa2d00' // signature-coral
const BRAND_FOREST = '#0a2e0e' // signature-forest
const TEXT_GRAY = '#5a5f67' // secondary
const BG_GRAY = '#f8fafc' // surface-soft
const INK = '#181d26'

export async function sendEncryptedDataEmail(
  toEmail: string,
  senderEmail: string,
  encryptedPayload: Record<string, unknown>
) {
  const decryptUrl = `${APP_URL}?tab=decrypt`
  const payloadJson = JSON.stringify(encryptedPayload, null, 2)
  const payloadBase64 = Buffer.from(payloadJson).toString('base64')

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You've received an encrypted message</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BG_GRAY}; color: ${INK};">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: ${BG_GRAY}; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #dddddd;">

              <!-- Header -->
              <tr>
                <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #dddddd;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; color: ${INK};">
                    AwesomeIBE
                  </h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: ${TEXT_GRAY};">Identity-Based Encryption</p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 32px 40px;">
                  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: ${INK};">
                    You've received an encrypted message
                  </h2>

                  <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${TEXT_GRAY};">
                    <strong style="color: ${INK};">${senderEmail}</strong> has sent you an encrypted message that only you can decrypt.
                  </p>

                  <!-- Encrypted For Badge -->
                  <div style="background-color: ${BG_GRAY}; border: 1px solid #dddddd; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
                    <p style="margin: 0; font-size: 13px; color: ${TEXT_GRAY};">
                      <span style="color: ${BRAND_COLOR}; font-weight: 600;">Encrypted for:</span> ${toEmail}
                    </p>
                  </div>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding: 0 0 32px 0;">
                        <a href="${decryptUrl}" style="display: inline-block; background-color: ${INK}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; padding: 12px 24px; border-radius: 9999px;">
                          Decrypt Message &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Attachment Notice -->
                  <div style="background-color: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
                    <p style="margin: 0; font-size: 14px; color: ${BRAND_FOREST};">
                      <strong>Attachment included:</strong> The encrypted payload is attached as <code style="background-color: #c8e6c9; padding: 2px 6px; border-radius: 4px; font-size: 13px;">encrypted-message.sealed.json</code>
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 13px; color: ${TEXT_GRAY};">
                      Download and upload it to the decrypt page, or copy the payload below.
                    </p>
                  </div>

                  <!-- Payload Code Block -->
                  <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: ${INK};">
                    Encrypted Payload:
                  </p>
                  <div style="background-color: ${INK}; border-radius: 8px; padding: 16px; overflow-x: auto;">
                    <pre style="margin: 0; font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 11px; color: #e0e0e0; white-space: pre-wrap; word-break: break-all; line-height: 1.5;">${payloadJson}</pre>
                  </div>

                  <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.6; color: #999999;">
                    To decrypt: Sign in with your email (${toEmail}) at the IBE platform. The distributed key servers will verify your identity before releasing decryption key shares.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: ${INK}; padding: 24px 40px;">
                  <p style="margin: 0; font-size: 13px; color: #888888;">Powered by <strong style="color: #ffffff;">AwesomeIBE</strong></p>
                  <p style="margin: 4px 0 0 0; font-size: 11px; color: #666666;">Distributed Identity-Based Encryption</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; margin-top: 16px;">
              <tr>
                <td align="center">
                  <a href="${APP_URL}" style="font-size: 12px; color: #888888; text-decoration: none;">Visit AwesomeIBE Platform</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const textContent = `You've received an encrypted message

${senderEmail} has sent you an encrypted message that only you can decrypt.

Encrypted for: ${toEmail}

ATTACHMENT INCLUDED: The encrypted payload is attached as "encrypted-message.sealed.json"
Download and upload it to the decrypt page, or copy the payload below.

To decrypt this message:
1. Visit ${decryptUrl}
2. Sign in with your email address (${toEmail})
3. Upload the attached JSON file or paste the encrypted payload below

Encrypted Payload:
${payloadJson}

The distributed key servers will verify your identity before releasing the decryption key shares.

---
Powered by AwesomeIBE - Distributed Identity-Based Encryption
${APP_URL}`

  // Generate unique boundary for MIME parts
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`

  // Construct raw MIME message with attachment
  const rawMessage = [
    `From: ${EMAIL_FROM_ADDRESS}`,
    `To: ${toEmail}`,
    `Subject: Encrypted message from ${senderEmail}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    textContent,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlContent,
    ``,
    `--${altBoundary}--`,
    ``,
    `--${boundary}`,
    `Content-Type: application/json; name="encrypted-message.sealed.json"`,
    `Content-Disposition: attachment; filename="encrypted-message.sealed.json"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    payloadBase64,
    ``,
    `--${boundary}--`,
  ].join('\r\n')

  const command = new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from(rawMessage),
    },
  })

  try {
    const response = await sesClient.send(command)
    return { success: true, messageId: response.MessageId }
  } catch (error) {
    console.error('Failed to send encrypted data email:', error)
    return { success: false, error }
  }
}
