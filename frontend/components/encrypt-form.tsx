'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'

interface EncryptFormProps {
  user: User
}

type SealedData = Record<string, unknown>

export function EncryptForm({ user }: EncryptFormProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [plaintext, setPlaintext] = useState('')
  const [sealedData, setSealedData] = useState<SealedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const handleEncrypt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await encryptMessage()
  }

  const encryptMessage = async (): Promise<SealedData | null> => {
    setLoading(true)
    setError(null)
    setSealedData(null)
    setEmailSent(false)

    try {
      const response = await fetch('/api/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plaintext,
          recipientEmail,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Encryption failed')
      }

      const { sealed } = await response.json()
      setSealedData(sealed)
      return sealed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleEncryptAndSendEmail = async () => {
    setError(null)
    setEmailSent(false)

    // First encrypt the message
    setLoading(true)
    const sealed = await encryptMessage()

    if (!sealed) {
      return
    }

    // Then send the email
    setSendingEmail(true)
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          encryptedPayload: sealed,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to send email')
      }

      setEmailSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleCopy = () => {
    if (sealedData) {
      navigator.clipboard.writeText(JSON.stringify(sealedData, null, 2))
    }
  }

  const handleDownload = () => {
    if (sealedData) {
      const blob = new Blob([JSON.stringify(sealedData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `encrypted-for-${recipientEmail}.sealed.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const isProcessing = loading || sendingEmail

  return (
    <div className="bg-canvas border border-hairline rounded-xl p-lg">
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-signature-coral">lock</span>
          <h2 className="text-title-sm text-ink font-medium">Encrypt Data</h2>
        </div>
      </div>
      <p className="text-body-md text-secondary mb-lg">
        Encrypt data for a specific user using Identity-Based Encryption. The message will be
        encrypted by the key server.
      </p>

      <form onSubmit={handleEncrypt} className="space-y-md">
        <div>
          <label htmlFor="recipient" className="block text-label-md text-ink mb-xs">
            Recipient Email
          </label>
          <input
            id="recipient"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full px-md py-sm border border-hairline rounded-lg text-body-md focus:outline-none focus:ring-2 focus:ring-signature-coral focus:border-transparent bg-canvas"
            required
          />
        </div>

        <div>
          <label htmlFor="plaintext" className="block text-label-md text-ink mb-xs">
            Message to Encrypt
          </label>
          <textarea
            id="plaintext"
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            placeholder="Enter your secret message..."
            rows={4}
            className="w-full px-md py-sm border border-hairline rounded-lg text-body-md focus:outline-none focus:ring-2 focus:ring-signature-coral focus:border-transparent bg-canvas resize-none"
            required
          />
        </div>

        <div className="flex gap-sm">
          <button
            type="submit"
            disabled={isProcessing || !recipientEmail || !plaintext}
            className="flex-1 px-lg py-sm text-button text-on-primary bg-signature-coral rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-xs"
          >
            {loading && !sendingEmail ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                Encrypting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">lock</span>
                Encrypt
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleEncryptAndSendEmail}
            disabled={isProcessing || !recipientEmail || !plaintext}
            className="flex-1 px-lg py-sm text-button text-on-primary bg-[#2563EB] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-xs"
          >
            {sendingEmail ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                Sending...
              </>
            ) : loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                Encrypting...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Encrypt & Send Email
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-md p-md bg-error-container border border-error/20 rounded-lg">
          <p className="text-body-md text-on-error-container">{error}</p>
        </div>
      )}

      {emailSent && (
        <div className="mt-md p-md bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-green-600 text-[20px]">
              check_circle
            </span>
            <p className="text-body-md text-green-800">
              Encrypted message sent to <strong>{recipientEmail}</strong>
            </p>
          </div>
        </div>
      )}

      {sealedData && (
        <div className="mt-md">
          <div className="flex items-center justify-between mb-xs">
            <label className="text-label-md text-ink">Encrypted Output</label>
            <div className="flex gap-xs">
              <button
                onClick={handleCopy}
                className="px-sm py-xxs text-caption text-secondary bg-surface-soft rounded hover:bg-surface-container-high transition-colors flex items-center gap-xxs"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="px-sm py-xxs text-caption text-secondary bg-surface-soft rounded hover:bg-surface-container-high transition-colors flex items-center gap-xxs"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download
              </button>
            </div>
          </div>
          <pre className="p-md bg-surface-soft border border-hairline rounded-lg text-caption font-mono overflow-auto max-h-48">
            {JSON.stringify(sealedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
