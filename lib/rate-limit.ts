/**
 * Postgres-backed sliding-window rate limiter.
 *
 * Calls the `rate_limit_hit(key, max, window_seconds)` SECURITY DEFINER function
 * which atomically increments the counter and resets the window when it expires.
 * Uses the service-role admin client so RLS does not need a policy.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

export interface RateLimitArgs {
  /** Unique key for this caller, e.g. `ai_chat:user_uuid` or `magic_link:1.2.3.4` */
  key: string
  /** Max hits allowed inside the window */
  max: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  currentCount: number
  resetAt: Date
}

export async function rateLimit({
  key,
  max,
  windowSeconds,
}: RateLimitArgs): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  })

  if (error || !data || data.length === 0) {
    // Fail open. Better to serve the request than to lock everyone out if the
    // counter table goes sideways. Log so we notice in production.
    console.warn('[rate-limit] RPC failed, allowing request:', error?.message)
    return {
      allowed: true,
      currentCount: 0,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    }
  }

  const row = data[0]
  return {
    allowed: row.allowed,
    currentCount: row.current_count,
    resetAt: new Date(row.reset_at),
  }
}
