'use client'

import { useEffect, useState } from 'react'

interface Config {
  threshold: number
  masterPublicKeyHex: string
  servers: string[]
  source: 'server' | 'env'
}

export function SystemConfig() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/config')
        if (!response.ok) {
          throw new Error('Failed to fetch configuration')
        }
        const data = await response.json()
        setConfig(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">Failed to load system configuration: {error}</p>
      </div>
    )
  }

  if (!config) return null

  const truncatedKey = `${config.masterPublicKeyHex.slice(0, 32)}...${config.masterPublicKeyHex.slice(-16)}`

  return (
    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-purple-900">System Configuration</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${
          config.source === 'server'
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {config.source === 'server' ? 'Live from servers' : 'From environment'}
        </span>
      </div>

      <div className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Threshold:</span>
          <span className="font-mono bg-white px-2 py-1 rounded border border-gray-200">
            {config.threshold} of {config.servers.length}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600">Master Public Key:</span>
            <button
              onClick={() => copyToClipboard(config.masterPublicKeyHex)}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              Copy
            </button>
          </div>
          <div
            className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200 break-all cursor-pointer hover:bg-gray-50"
            onClick={() => setExpanded(!expanded)}
            title="Click to expand/collapse"
          >
            {expanded ? config.masterPublicKeyHex : truncatedKey}
          </div>
        </div>

        <div>
          <span className="text-gray-600">Key Servers:</span>
          <div className="mt-1 space-y-1">
            {config.servers.map((server, i) => (
              <div key={i} className="flex items-center gap-2">
                <ServerStatus url={server} />
                <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200">
                  {server}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ServerStatus({ url }: { url: string }) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch(`${url}/service`, {
          mode: 'cors',
          signal: AbortSignal.timeout(3000),
        })
        setStatus(response.ok ? 'online' : 'offline')
      } catch {
        setStatus('offline')
      }
    }

    checkStatus()
  }, [url])

  return (
    <span className={`w-2 h-2 rounded-full ${
      status === 'checking' ? 'bg-gray-300 animate-pulse' :
      status === 'online' ? 'bg-green-500' : 'bg-red-500'
    }`} title={status} />
  )
}
