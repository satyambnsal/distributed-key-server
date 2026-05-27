import { createClient } from '@/lib/supabase-server'
import { AuthButton } from '@/components/auth-button'
import { EncryptForm } from '@/components/encrypt-form'
import { DecryptForm } from '@/components/decrypt-form'
import { SystemConfig } from '@/components/system-config'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-canvas">
      {/* Navigation Bar */}
      <nav className="flex justify-between items-center h-20 px-xxl w-full sticky top-0 z-50 bg-canvas/80 backdrop-blur-md border-b border-hairline">
        <div className="text-display-md font-bold text-ink tracking-tight">AwesomeIBE</div>
        {user ? (
          <div className="flex items-center gap-md">
            <span className="text-body-md text-secondary hidden md:block">{user.email}</span>
            <AuthButton user={user} />
          </div>
        ) : (
          <div className="flex items-center gap-md">
            <AuthButton user={null} />
          </div>
        )}
      </nav>

      {user ? (
        /* Dashboard for Authenticated Users */
        <div className="max-w-[1440px] mx-auto px-xxl py-xl">
          {/* User Identity Banner */}
          <div className="mb-xl p-lg bg-surface-soft border border-hairline rounded-xl">
            <div className="flex items-center gap-sm mb-xs">
              <span className="material-symbols-outlined text-signature-coral">fingerprint</span>
              <span className="text-label-md text-ink font-medium">Your Identity</span>
            </div>
            <code className="block text-title-sm text-ink bg-surface-container px-md py-sm rounded-lg font-mono">
              user:{user.email}
            </code>
            <p className="text-body-md text-secondary mt-sm">
              Others can encrypt data for you using this identity. You can decrypt anything
              encrypted for this identity.
            </p>
          </div>

          {/* System Configuration */}
          <div className="mb-xl">
            <SystemConfig />
          </div>

          {/* Encrypt/Decrypt Grid */}
          <div className="grid md:grid-cols-2 gap-xl">
            <EncryptForm user={user} />
            <DecryptForm user={user} />
          </div>

          {/* How it Works Section */}
          <section className="mt-section py-xl">
            <h3 className="text-display-md text-ink mb-xl">How it works</h3>
            <div className="grid md:grid-cols-3 gap-xl">
              <div className="flex gap-md">
                <span className="text-title-lg text-signature-coral font-medium">01</span>
                <div>
                  <h4 className="text-title-sm text-ink mb-xs">Encrypt Locally</h4>
                  <p className="text-body-md text-secondary">
                    Encryption happens in your browser using the recipient&apos;s email as their
                    identity. No server sees your plaintext.
                  </p>
                </div>
              </div>
              <div className="flex gap-md">
                <span className="text-title-lg text-signature-coral font-medium">02</span>
                <div>
                  <h4 className="text-title-sm text-ink mb-xs">Distributed Keys</h4>
                  <p className="text-body-md text-secondary">
                    Decryption keys are split across 3 servers. At least 2 must cooperate to decrypt
                    (threshold = 2).
                  </p>
                </div>
              </div>
              <div className="flex gap-md">
                <span className="text-title-lg text-signature-coral font-medium">03</span>
                <div>
                  <h4 className="text-title-sm text-ink mb-xs">Identity Verified</h4>
                  <p className="text-body-md text-secondary">
                    Servers verify your identity via email before releasing key shares. Only you can
                    decrypt your messages.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* Landing Page for Unauthenticated Users */
        <>
          {/* Hero Section */}
          <header className="relative overflow-hidden bg-canvas py-section">
            <div className="max-w-[1440px] mx-auto px-xxl">
              <div className="max-w-3xl">
                <h1 className="text-display-xl tracking-tight text-ink mb-md">
                  Identity-Based Encryption
                </h1>
                <p className="text-title-md text-secondary mb-xl leading-relaxed">
                  Encrypt data for anyone using just their email address. No pre-shared keys, no
                  certificates, no complexity. AwesomeIBE brings editorial-grade security to modern
                  workflows.
                </p>
                <div className="flex flex-wrap gap-md">
                  <AuthButton user={null} />
                </div>
              </div>
              {/* Hero Image */}
              <div className="mt-section relative h-[400px] w-full rounded-xl overflow-hidden bg-surface-soft border border-hairline">
                <div className="absolute inset-0 bg-gradient-to-br from-signature-coral/10 via-transparent to-signature-forest/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-[120px] text-signature-coral/20">
                      lock
                    </span>
                    <p className="text-title-md text-secondary mt-md">
                      Secure. Simple. Identity-Based.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Feature Grid Section */}
          <section className="py-section bg-surface-soft border-y border-hairline">
            <div className="max-w-[1440px] mx-auto px-xxl">
              <div className="mb-xl">
                <span className="text-label-md text-signature-coral mb-xs block">
                  Architectural Advantage
                </span>
                <h2 className="text-display-md text-ink tracking-tight">
                  Security without the friction.
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
                {/* Card 1: Coral */}
                <div className="bg-signature-coral text-on-primary p-xxl rounded-xl flex flex-col justify-between min-h-[380px] hover:scale-[1.01] transition-transform">
                  <div>
                    <span className="material-symbols-outlined text-[48px] mb-md">key_off</span>
                    <h3 className="text-display-md mb-md leading-none">No Key Exchange</h3>
                  </div>
                  <p className="text-body-md opacity-90 leading-relaxed">
                    Eliminate the &quot;trust-on-first-use&quot; problem. Encrypt sensitive assets
                    using a public identifier like an email address before the recipient even
                    registers.
                  </p>
                </div>
                {/* Card 2: Forest */}
                <div className="bg-signature-forest text-on-primary p-xxl rounded-xl flex flex-col justify-between min-h-[380px] hover:scale-[1.01] transition-transform">
                  <div>
                    <span className="material-symbols-outlined text-[48px] mb-md">security</span>
                    <h3 className="text-display-md mb-md leading-none">Threshold Security</h3>
                  </div>
                  <p className="text-body-md opacity-90 leading-relaxed">
                    Private keys are generated through a distributed network of nodes. No single
                    entity ever possesses the full master key, ensuring total sovereignty.
                  </p>
                </div>
                {/* Card 3: White Canvas */}
                <div className="bg-canvas border border-hairline p-xxl rounded-xl flex flex-col justify-between min-h-[380px] hover:scale-[1.01] transition-transform">
                  <div>
                    <span className="material-symbols-outlined text-[48px] mb-md text-signature-coral">
                      privacy_tip
                    </span>
                    <h3 className="text-display-md mb-md leading-none text-ink">Privacy First</h3>
                  </div>
                  <p className="text-body-md text-secondary leading-relaxed">
                    Identity-based encryption ensures that even metadata is shielded. Your internal
                    workflows remain invisible to external observers and service providers.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Technical Overview Section */}
          <section className="py-section bg-canvas">
            <div className="max-w-[1440px] mx-auto px-xxl">
              <span className="text-label-md text-secondary border-b border-hairline pb-xs mb-lg inline-block">
                Technical Overview
              </span>
              <h2 className="text-display-lg text-ink mb-xl leading-tight max-w-2xl">
                The future of encryption is identity driven.
              </h2>
              <div className="grid md:grid-cols-3 gap-xl">
                <div className="flex gap-md">
                  <span className="text-title-lg text-signature-coral font-medium">01</span>
                  <div>
                    <h4 className="text-title-sm text-ink mb-xs">Identifier as Public Key</h4>
                    <p className="text-body-md text-secondary">
                      Any string can be a public key. We use verified email addresses to map
                      identities to cryptographic material instantly.
                    </p>
                  </div>
                </div>
                <div className="flex gap-md">
                  <span className="text-title-lg text-signature-coral font-medium">02</span>
                  <div>
                    <h4 className="text-title-sm text-ink mb-xs">Stateless Decryption</h4>
                    <p className="text-body-md text-secondary">
                      Recipients don&apos;t need to be online or have previously generated keys to
                      receive encrypted data.
                    </p>
                  </div>
                </div>
                <div className="flex gap-md">
                  <span className="text-title-lg text-signature-coral font-medium">03</span>
                  <div>
                    <h4 className="text-title-sm text-ink mb-xs">Automated Revocation</h4>
                    <p className="text-body-md text-secondary">
                      Key life-cycles are managed through identity TTLs, making traditional
                      revocation lists obsolete.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-hairline py-lg px-xxl">
        <div className="max-w-[1440px] mx-auto flex justify-center">
          <a
            href="https://hackmd.io/@satyambnsal/HJc5NtEgfx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-md text-secondary hover:text-ink transition-colors"
          >
            Architecture Documentation
          </a>
        </div>
      </footer>
    </main>
  )
}
