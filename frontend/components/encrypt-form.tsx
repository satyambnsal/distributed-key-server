'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'

interface EncryptFormProps {
  user: User
}

export function EncryptForm({ user }: EncryptFormProps) {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [plaintext, setPlaintext] = useState('')
  const [sealedData, setSealedData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEncrypt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSealedData(null)

    try {
      // Call server-side encryption API
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
      setSealedData(JSON.stringify(sealed, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (sealedData) {
      navigator.clipboard.writeText(sealedData)
    }
  }

  const handleDownload = () => {
    if (sealedData) {
      const blob = new Blob([sealedData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `encrypted-for-${recipientEmail}.sealed.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="bg-canvas border border-hairline rounded-xl p-lg">
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-signature-coral">lock</span>
          <h2 className="text-title-sm text-ink font-medium">Encrypt Data</h2>
        </div>
        <span className="text-caption px-sm py-xxs bg-surface-soft text-secondary rounded-full">
          Server-side
        </span>
      </div>
      <p className="text-body-md text-secondary mb-lg">
        Encrypt data for a specific user using Identity-Based Encryption. The message will be encrypted by the key server.
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

        <button
          type="submit"
          disabled={loading}
          className="w-full px-lg py-sm text-button text-on-primary bg-signature-coral rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-xs"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              Encrypting...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">lock</span>
              Encrypt
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-md p-md bg-error-container border border-error/20 rounded-lg">
          <p className="text-body-md text-on-error-container">{error}</p>
        </div>
      )}

      {sealedData && (
        <div className="mt-md">
          <div className="flex items-center justify-between mb-xs">
            <label className="text-label-md text-ink">
              Encrypted Output
            </label>
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
            {sealedData}
          </pre>
        </div>
      )}
    </div>
  )
}
