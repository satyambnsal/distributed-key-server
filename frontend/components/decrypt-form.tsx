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

  const handleDecrypt = async (e: React.FormEvent) => {
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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Decrypt Data</h2>
      <p className="text-sm text-gray-500 mb-4">
        Decrypt data that was encrypted for your identity ({user.email}).
      </p>

      <form onSubmit={handleDecrypt} className="space-y-4">
        <div>
          <label htmlFor="sealed" className="block text-sm font-medium text-gray-700 mb-1">
            Sealed Data (JSON)
          </label>
          <textarea
            id="sealed"
            value={sealedInput}
            onChange={(e) => setSealedInput(e.target.value)}
            placeholder='{"version":1,"key_id":"user:...","threshold":2,...}'
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            required
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload .sealed.json
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Decrypting...' : 'Decrypt'}
        </button>
      </form>

      {status && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-600 flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {status}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {decryptedText && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Decrypted Message
          </label>
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-gray-800 whitespace-pre-wrap">{decryptedText}</p>
          </div>
        </div>
      )}
    </div>
  )
}
