/**
 * Magic Link Authentication Service
 *
 * Tokens are stored as SHA-256 hashes with an explicit expiry. The raw token
 * lives only in the email URL we send and is single-use.
 *
 * Redemption flow: the route handler validates our token, then mints a real
 * Supabase session via auth.admin.generateLink + verifyOtp on the client.
 * We never overwrite a user's password.
 */

import { randomBytes, createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60 // 7 days
const TOKEN_BYTES = 32

export interface MagicLinkOptions {
  employeeId: string
  surveyId: string
  email: string
  expiresIn?: number
  locale?: 'en' | 'mn' | string
}

export interface MagicLinkResult {
  url: string
  expiresAt: Date
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/**
 * Generate a fresh magic link for an employee. Replaces any existing token.
 */
export async function generateMagicLink(
  options: MagicLinkOptions
): Promise<MagicLinkResult> {
  const { employeeId, surveyId, email: _email, expiresIn = DEFAULT_EXPIRATION_SECONDS, locale = 'en' } = options
  void _email // email is used by callers downstream; kept in signature for clarity

  const rawToken = generateRawToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      activation_token_hash: tokenHash,
      activation_token_expires_at: expiresAt.toISOString(),
      invitation_consumed_at: null,
      invitation_status: 'invited',
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)

  if (error) {
    throw new Error(`Failed to store magic link token: ${error.message}`)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = `${baseUrl}/${locale}/auth/magic-link?token=${rawToken}&survey=${surveyId}`

  return { url, expiresAt }
}

/**
 * Check if an employee currently has a magic link that can be reused for a reminder.
 * Returns false if the token is missing, expired, or already consumed.
 */
export async function hasValidToken(employeeId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('activation_token_hash, activation_token_expires_at, invitation_consumed_at')
    .eq('id', employeeId)
    .single()

  if (!profile?.activation_token_hash) return false
  if (profile.invitation_consumed_at) return false
  if (!profile.activation_token_expires_at) return false
  return new Date(profile.activation_token_expires_at).getTime() > Date.now()
}

/**
 * Invalidate any active magic link for the given employee.
 */
export async function invalidateToken(employeeId: string): Promise<void> {
  await supabaseAdmin
    .from('profiles')
    .update({
      activation_token_hash: null,
      activation_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
}
