import { createClient } from '@/lib/supabase-server'
import { AuthButton } from '@/components/auth-button'
import { EncryptForm } from '@/components/encrypt-form'
import { DecryptForm } from '@/components/decrypt-form'
import { SystemConfig } from '@/components/system-config'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AwesomeIBE</h1>
              <p className="text-xs text-gray-500">Identity-Based Encryption</p>
            </div>
          </div>
          <AuthButton user={user} />
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {user ? (
          <>
            {/* User Info Banner */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Your identity:</span>{' '}
                <code className="px-2 py-1 bg-blue-100 rounded">user:{user.email}</code>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Others can encrypt data for you using this identity. You can decrypt anything encrypted for this identity.
              </p>
            </div>

            {/* System Configuration */}
            <div className="mb-8">
              <SystemConfig />
            </div>

            {/* Encrypt/Decrypt Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              <EncryptForm user={user} />
              <DecryptForm user={user} />
            </div>

            {/* Info Section */}
            <div className="mt-8 p-6 bg-white rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">How it works</h3>
              <div className="grid md:grid-cols-3 gap-6 text-sm text-gray-600">
                <div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <span className="text-blue-600 font-bold">1</span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">Encrypt Locally</h4>
                  <p>Encryption happens in your browser using the recipient&apos;s email as their identity. No server sees your plaintext.</p>
                </div>
                <div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <span className="text-blue-600 font-bold">2</span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">Distributed Keys</h4>
                  <p>Decryption keys are split across 3 servers. At least 2 must cooperate to decrypt (threshold = 2).</p>
                </div>
                <div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <span className="text-blue-600 font-bold">3</span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">Identity Verified</h4>
                  <p>Servers verify your identity (via GitHub or email) before releasing key shares. Only you can decrypt your messages.</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Landing Page for Unauthenticated Users */
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Identity-Based Encryption
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">
              Encrypt data for anyone using just their email address.
              No need to exchange public keys. Decryption keys are distributed across multiple servers.
            </p>

            <div className="flex justify-center mb-12">
              <AuthButton user={null} />
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-left">
              <div className="p-6 bg-white rounded-lg shadow">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">No Key Exchange</h3>
                <p className="text-sm text-gray-600">
                  Encrypt for anyone using their email. No need to get their public key first.
                </p>
              </div>

              <div className="p-6 bg-white rounded-lg shadow">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Threshold Security</h3>
                <p className="text-sm text-gray-600">
                  Keys split across 3 servers. Need 2 to decrypt. No single point of failure.
                </p>
              </div>

              <div className="p-6 bg-white rounded-lg shadow">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Privacy First</h3>
                <p className="text-sm text-gray-600">
                  Encryption happens locally. Servers never see your plaintext data.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
