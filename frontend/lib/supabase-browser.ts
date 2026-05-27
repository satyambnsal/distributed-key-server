import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/database.types'
import { supabaseUrl, supabaseAnonKey } from '@/constants'

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    db: {
      schema: 'awesomeibe',
    },
  })
}
