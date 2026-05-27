import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { APP_URL, EMAIL_FROM_ADDRESS } from '@/constants'

const sesClient = new SESClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  region: process.env.AWS_REGION || 'us-east-1',
})

const BRAND_COLOR = '#E85D4C' // signature-coral
const TEXT_GRAY = '#5F5C5C'
const BG_GRAY = '#F5F5F5'

interface EncryptedPayload {
  ciphertext: string
  nonce: string
  key_id: string
  encapsulation: string
}

export async function sendEncryptedDataEmail(
  toEmail: string,
  senderEmail: string,
  encryptedPayload: EncryptedPayload
) {
  const decryptUrl = `${APP_URL}?tab=decrypt`
  const payloadJson = JSON.stringify(encryptedPayload, null, 2)

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>You've received an encrypted message</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: ${BG_GRAY}; color: #000000;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: ${BG_GRAY}; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #EAEAEA;">

              <tr>
                <td align="center" style="padding: 40px 40px 20px 40px;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                    <span style="color: ${BRAND_COLOR};">IBE</span> Secure Message
                  </h1>
                  <p style="margin: 8px 0 0 0; font-size: 14px; color: ${TEXT_GRAY};">Identity-Based Encryption</p>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding: 0 40px;">
                  <div style="height: 1px; width: 100%; background-color: #EAEAEA;"></div>
                </td>
              </tr>

              <tr>
                <td style="padding: 30px 40px;">
                  <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; text-align: center;">
                    You've received an <span style="color: ${BRAND_COLOR};">encrypted message</span>
                  </h2>

                  <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${TEXT_GRAY}; text-align: center;">
                    <strong>${senderEmail}</strong> has sent you an encrypted message that only you can decrypt.
                  </p>

                  <div style="background-color: #FEF3F2; border: 1px solid ${BRAND_COLOR}; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: ${TEXT_GRAY}; text-align: center;">
                      <strong>Encrypted for:</strong> ${toEmail}
                    </p>
                  </div>

                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td align="center" style="padding: 8px 0 24px 0;">
                        <a href="${decryptUrl}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; letter-spacing: 0.3px;">
                          Decrypt Message
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #000;">
                    Encrypted Payload (paste this to decrypt):
                  </p>
                  <div style="background-color: #1a1a1a; border-radius: 8px; padding: 16px; overflow-x: auto;">
                    <pre style="margin: 0; font-family: 'Monaco', 'Menlo', monospace; font-size: 11px; color: #e0e0e0; white-space: pre-wrap; word-break: break-all;">${payloadJson}</pre>
                  </div>

                  <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.6; color: #999999; text-align: center;">
                    To decrypt this message, sign in to the IBE platform with your email address (${toEmail}). The distributed key servers will verify your identity before releasing the decryption key shares.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="background-color: #111111; padding: 20px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #666666;">Powered by Distributed Identity-Based Encryption</p>
                  <p style="margin: 5px 0 0 0; font-size: 11px; color: #444444;">Threshold cryptography for secure communication</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; margin-top: 20px;">
              <tr>
                <td align="center">
                  <a href="${APP_URL}" style="font-size: 12px; color: #888888; text-decoration: none;">Visit IBE Platform</a>
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

To decrypt this message:
1. Visit ${decryptUrl}
2. Sign in with your email address (${toEmail})
3. Paste the encrypted payload below

Encrypted Payload:
${payloadJson}

The distributed key servers will verify your identity before releasing the decryption key shares.

---
Powered by Distributed Identity-Based Encryption
${APP_URL}`

  const command = new SendEmailCommand({
    Source: EMAIL_FROM_ADDRESS,
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: `Encrypted message from ${senderEmail}`, Charset: 'UTF-8' },
      Body: {
        Html: { Data: htmlContent, Charset: 'UTF-8' },
        Text: { Data: textContent, Charset: 'UTF-8' },
      },
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
