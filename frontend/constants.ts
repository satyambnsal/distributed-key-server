// Server-side only
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Available on both server and client (NEXT_PUBLIC_ prefix)
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// IBE Configuration
export const ibeConfig = {
  threshold: 2,
  masterPublicKeyHex: process.env.NEXT_PUBLIC_MASTER_PUBLIC_KEY_HEX || '',
  servers: [
    process.env.NEXT_PUBLIC_KEY_SERVER_1 || 'http://127.0.0.1:4101',
    process.env.NEXT_PUBLIC_KEY_SERVER_2 || 'http://127.0.0.1:4102',
    process.env.NEXT_PUBLIC_KEY_SERVER_3 || 'http://127.0.0.1:4103',
  ],
}

export const APP_URL = "https://distributed-key-server.vercel.app"

// Email configuration
export const EMAIL_FROM_ADDRESS = "no-reply@ravenhouse.xyz"
