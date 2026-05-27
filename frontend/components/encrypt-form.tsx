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

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSealedData(null)

    try {
      const response = await fetch('/api/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_id: `user:${recipientEmail}`,
          plaintext,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Encryption failed')
      }

      const data = await response.json()
      setSealedData(JSON.stringify(data.sealed, null, 2))
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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Encrypt Data</h2>
      <p className="text-sm text-gray-500 mb-4">
        Encrypt data for a specific user. Only they will be able to decrypt it.
      </p>

      <form onSubmit={handleEncrypt} className="space-y-4">
        <div>
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-1">
            Recipient Email
          </label>
          <input
            id="recipient"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="plaintext" className="block text-sm font-medium text-gray-700 mb-1">
            Message to Encrypt
          </label>
          <textarea
            id="plaintext"
            value={plaintext}
            onChange={(e) => setPlaintext(e.target.value)}
            placeholder="Enter your secret message..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Encrypting...' : 'Encrypt'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {sealedData && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Encrypted Output
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Download
              </button>
            </div>
          </div>
          <pre className="p-3 bg-gray-50 border border-gray-200 rounded-md text-xs overflow-auto max-h-48">
            {sealedData}
          </pre>
        </div>
      )}
    </div>
  )
}
