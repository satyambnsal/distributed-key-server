'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'

interface DecryptFormProps {
  user: User
}

export function DecryptForm({ user }: DecryptFormProps) {
  const [sealedInput, setSealedInput] = useState('')
  const [decryptedText, setDecryptedText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const handleDecrypt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setDecryptedText(null)
    setStatus('Parsing sealed data...')

    try {
      const sealed = JSON.parse(sealedInput)

      // Verify the key_id matches the user
      const expectedKeyId = `user:${user.email}`
      if (sealed.key_id !== expectedKeyId) {
        throw new Error(`This message was encrypted for ${sealed.key_id}, but you are ${expectedKeyId}`)
      }

      setStatus('Fetching key shares from servers...')

      const response = await fetch('/api/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sealed }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Decryption failed')
      }

      const data = await response.json()
      setDecryptedText(data.plaintext)
      setStatus(null)
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format. Please paste valid sealed data.')
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setSealedInput(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="bg-canvas border border-hairline rounded-xl p-lg">
      <div className="flex items-center gap-sm mb-md">
        <span className="material-symbols-outlined text-signature-forest">lock_open</span>
        <h2 className="text-title-sm text-ink font-medium">Decrypt Data</h2>
      </div>
      <p className="text-body-md text-secondary mb-lg">
        Decrypt data that was encrypted for your identity ({user.email}).
      </p>

      <form onSubmit={handleDecrypt} className="space-y-md">
        <div>
          <label htmlFor="sealed" className="block text-label-md text-ink mb-xs">
            Sealed Data (JSON)
          </label>
          <textarea
            id="sealed"
            value={sealedInput}
            onChange={(e) => setSealedInput(e.target.value)}
            placeholder='{"version":1,"key_id":"user:...","threshold":2,...}'
            rows={6}
            className="w-full px-md py-sm border border-hairline rounded-lg text-body-md font-mono focus:outline-none focus:ring-2 focus:ring-signature-forest focus:border-transparent bg-canvas resize-none"
            required
          />
        </div>

        <label className="flex items-center gap-sm px-md py-sm text-body-md text-secondary bg-surface-soft rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors w-fit">
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          Upload .sealed.json
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-lg py-sm text-button text-on-primary bg-signature-forest rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-xs"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              Decrypting...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              Decrypt
            </>
          )}
        </button>
      </form>

      {status && (
        <div className="mt-md p-md bg-surface-soft border border-hairline rounded-lg">
          <p className="text-body-md text-secondary flex items-center gap-sm">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            {status}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-md p-md bg-error-container border border-error/20 rounded-lg">
          <p className="text-body-md text-on-error-container">{error}</p>
        </div>
      )}

      {decryptedText && (
        <div className="mt-md">
          <label className="block text-label-md text-ink mb-xs">
            Decrypted Message
          </label>
          <div className="p-md bg-signature-mint/20 border border-signature-mint/40 rounded-lg">
            <p className="text-body-md text-ink whitespace-pre-wrap">{decryptedText}</p>
          </div>
        </div>
      )}
    </div>
  )
}
