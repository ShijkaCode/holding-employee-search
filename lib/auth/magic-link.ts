/**
 * Magic Link Authentication Service
 * Generates and validates passwordless authentication tokens
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createClientBrowser } from '@/lib/supabase/client'
import { randomBytes } from 'crypto'

const DEFAULT_EXPIRATION = 7 * 24 * 60 * 60 // 7 days in seconds
const TOKEN_LENGTH = 32 // bytes

export interface MagicLinkOptions {
  employeeId: string
  surveyId: string
  email: string
  expiresIn?: number // seconds
  locale?: string // 'en' | 'mn'
}

export interface MagicLinkResult {
  token: string
  url: string
  expiresAt: Date
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('base64url')
}

/**
 * Generate a magic link for an employee to access a survey
 * Server-side only
 */
export async function generateMagicLink(
  options: MagicLinkOptions
): Promise<MagicLinkResult> {
  const { employeeId, surveyId, email, expiresIn = DEFAULT_EXPIRATION, locale = 'en' } = options

  // Generate secure token
  const token = generateToken()

  // Calculate expiration
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  // ✅ FIX: Use admin client to bypass RLS policies
  const { supabaseAdmin } = await import('@/lib/supabase/admin')

  // Store token in profile
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      activation_token: token,
      invitation_status: 'invited',
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)

  if (error) {
    throw new Error(`Failed to store magic link token: ${error.message}`)
  }

  // Create magic link URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = `${baseUrl}/${locale}/auth/magic-link?token=${token}&survey=${surveyId}`

  return {
    token,
    url,
    expiresAt,
  }
}

/**
 * Validate a magic link token
 * Server-side only
 */
export async function validateMagicLinkToken(token: string): Promise<{
  valid: boolean
  employeeId?: string
  email?: string
  error?: string
}> {
  if (!token) {
    return { valid: false, error: 'Token is required' }
  }

  const supabase = await createClient()

  // Find profile with this token
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, activation_token, updated_at')
    .eq('activation_token', token)
    .single()

  if (error || !profile) {
    return { valid: false, error: 'Invalid or expired token' }
  }

  // Check if token is expired (7 days from last update)
  const tokenAge = Date.now() - new Date(profile.updated_at || Date.now()).getTime()
  const maxAge = DEFAULT_EXPIRATION * 1000

  if (tokenAge > maxAge) {
    // Token expired, clear it
    await supabase
      .from('profiles')
      .update({ activation_token: null })
      .eq('id', profile.id)

    return { valid: false, error: 'Token has expired' }
  }

  return {
    valid: true,
    employeeId: profile.id,
    email: profile.email ?? undefined,
  }
}

/**
 * Redeem a magic link token and create auth session
 * This exchanges the token for a Supabase Auth session
 */
export async function redeemMagicLink(token: string, surveyId?: string): Promise<{
  success: boolean
  error?: string
  sessionData?: Record<string, unknown>
  redirectUrl?: string
}> {
  // Validate token first
  const validation = await validateMagicLinkToken(token)

  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  const { employeeId, email } = validation

  if (!employeeId || !email) {
    return { success: false, error: 'Invalid token data' }
  }

  const supabase = await createClient()

  try {
    // Update profile timestamps and invitation status BEFORE creating session
    const now = new Date().toISOString()
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_login_at')
      .eq('id', employeeId)
      .single()

    await supabase
      .from('profiles')
      .update({
        activation_token: null, // Invalidate token after use
        invitation_status: 'activated',
        last_login_at: now,
        first_login_at: profile?.first_login_at || now,
      })
      .eq('id', employeeId)

    // Update survey invitation status if survey provided
    if (surveyId) {
      await supabase
        .from('survey_invitations')
        .update({
          status: 'clicked',
          clicked_at: now,
        })
        .eq('employee_id', employeeId)
        .eq('survey_id', surveyId)
    }

    // Generate auth session using admin API
    // This returns session tokens that can be set on the client
    const { supabaseAdmin } = await import('@/lib/supabase/admin')

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: surveyId
          ? `${process.env.NEXT_PUBLIC_APP_URL}/surveys/${surveyId}`
          : `${process.env.NEXT_PUBLIC_APP_URL}/surveys`,
      }
    })

    if (sessionError) {
      throw new Error(`Failed to create auth session: ${sessionError.message}`)
    }

    // Determine redirect URL
    const redirectUrl = surveyId ? `/surveys/${surveyId}` : '/surveys'

    return {
      success: true,
      sessionData: sessionData.properties,
      redirectUrl
    }
  } catch (error) {
    console.error('Magic link redemption error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to redeem magic link',
    }
  }
}

/**
 * Check if an employee has a valid magic link token
 * Useful for checking if invitation was already sent
 */
export async function hasValidToken(employeeId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('activation_token, updated_at')
    .eq('id', employeeId)
    .single()

  if (!profile?.activation_token) {
    return false
  }

  // Check if token is not expired
  const tokenAge = Date.now() - new Date(profile.updated_at || Date.now()).getTime()
  const maxAge = DEFAULT_EXPIRATION * 1000

  return tokenAge <= maxAge
}

/**
 * Invalidate a magic link token
 * Useful for security (e.g., user requests password reset)
 */
export async function invalidateToken(employeeId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('profiles')
    .update({
      activation_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employeeId)
}

// ✅ REMOVED: Phase 4 SMS placeholder code (YAGNI)
// - checkMagicLinkAccess() - unused
// - generateShortCode() - not needed yet
// - validateShortCode() - not needed yet
// Will add when Phase 4 is actually implemented
