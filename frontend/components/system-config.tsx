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
      <div className="p-lg bg-surface-soft border border-hairline rounded-xl animate-pulse">
        <div className="h-4 bg-surface-container-high rounded w-1/3"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-lg bg-error-container border border-error/20 rounded-xl">
        <p className="text-body-md text-on-error-container">Failed to load system configuration: {error}</p>
      </div>
    )
  }

  if (!config) return null

  const truncatedKey = `${config.masterPublicKeyHex.slice(0, 32)}...${config.masterPublicKeyHex.slice(-16)}`

  return (
    <div className="p-lg bg-surface-soft border border-hairline rounded-xl">
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-secondary">settings</span>
          <h3 className="text-title-sm text-ink font-medium">System Configuration</h3>
        </div>
        <span className={`text-caption px-sm py-xxs rounded-full ${
          config.source === 'server'
            ? 'bg-signature-mint/30 text-signature-forest'
            : 'bg-signature-yellow/30 text-signature-mustard'
        }`}>
          {config.source === 'server' ? 'Live from servers' : 'From environment'}
        </span>
      </div>

      <div className="grid gap-md text-body-md">
        <div className="flex items-center justify-between">
          <span className="text-secondary">Threshold:</span>
          <span className="font-mono bg-canvas px-sm py-xxs rounded border border-hairline">
            {config.threshold} of {config.servers.length}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-xs">
            <span className="text-secondary">Master Public Key:</span>
            <button
              onClick={() => copyToClipboard(config.masterPublicKeyHex)}
              className="text-caption text-signature-coral hover:text-signature-coral/80 flex items-center gap-xxs transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              Copy
            </button>
          </div>
          <div
            className="font-mono text-caption bg-canvas px-sm py-xs rounded border border-hairline break-all cursor-pointer hover:bg-surface-container-low transition-colors"
            onClick={() => setExpanded(!expanded)}
            title="Click to expand/collapse"
          >
            {expanded ? config.masterPublicKeyHex : truncatedKey}
          </div>
        </div>

        <div>
          <span className="text-secondary">Key Servers:</span>
          <div className="mt-xs space-y-xs">
            {config.servers.map((server, i) => (
              <div key={i} className="flex items-center gap-sm">
                <ServerStatus url={server} />
                <span className="font-mono text-caption bg-canvas px-sm py-xxs rounded border border-hairline">
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

  if (status === 'checking') {
    return <span className="w-2.5 h-2.5 rounded-full bg-outline animate-pulse" title="Checking..." />
  }

  if (status === 'online') {
    return (
      <span className="relative flex h-2.5 w-2.5" title="Online">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
      </span>
    )
  }

  return <span className="w-2.5 h-2.5 rounded-full bg-red-500" title="Offline" />
}
