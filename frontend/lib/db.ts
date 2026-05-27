import { supabaseServiceRoleKey, supabaseUrl } from '@/constants'
import { Database } from '@/lib/database.types'
import { createClient } from '@supabase/supabase-js'

// Service role client for server-side admin operations
export const supabaseServiceClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  db: {
    schema: 'awesomeibe',
  },
})
