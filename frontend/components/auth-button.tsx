'use client'

import { createClient } from '@/lib/supabase-browser'
import { User } from '@supabase/supabase-js'
import { useState } from 'react'
import { toast } from 'sonner'

interface AuthButtonProps {
  user: User | null
}

export function AuthButton({ user }: AuthButtonProps) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Check your email for the magic link!')
      setEmail('')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (user) {
    return (
      <button
        onClick={handleSignOut}
        className="px-lg py-xs text-button rounded-full border border-hairline hover:bg-surface-soft transition-colors"
      >
        Sign Out
      </button>
    )
  }

  return (
    <form onSubmit={handleEmailSignIn} className="flex flex-col sm:flex-row gap-sm">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        className="px-lg py-md text-body-md border border-hairline rounded-full focus:outline-none focus:ring-2 focus:ring-signature-coral focus:border-transparent bg-canvas"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-ink text-on-primary px-xl py-md rounded-full text-button hover:opacity-90 transition-all flex items-center justify-center gap-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          'Sending...'
        ) : (
          <>
            Sign in with email
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </>
        )}
      </button>
    </form>
  )
}
