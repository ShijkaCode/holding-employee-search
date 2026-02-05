/**
 * Supabase Admin Client
 * Uses service role key for administrative operations
 * NEVER expose this client to the browser
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let _supabaseAdmin: SupabaseClient<Database> | null = null

/**
 * Get admin client with service role privileges
 * Use for:
 * - Creating auth users during bulk import
 * - Generating magic link sessions
 * - Admin-only database operations that bypass RLS
 *
 * Note: Lazy initialization to avoid build-time errors when env vars are not set
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_supabaseAdmin) {
    return _supabaseAdmin
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY - required for admin operations')
  }

  _supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return _supabaseAdmin
}

// Legacy export for backward compatibility (use getSupabaseAdmin() instead)
// This creates the client lazily on first property access
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    return getSupabaseAdmin()[prop as keyof SupabaseClient<Database>]
  },
})
