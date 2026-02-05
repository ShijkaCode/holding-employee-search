'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Redeem a magic link token and create authenticated session
 * This is a Server Action that handles the entire magic link flow
 */
export async function redeemMagicLinkAction(token: string, surveyId?: string) {
  if (!token) {
    return { success: false, error: 'No magic link token provided' }
  }

  const supabase = await createClient()

  // Validate token using admin client (bypasses RLS)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, activation_token, updated_at')
    .eq('activation_token', token)
    .single()

  if (profileError || !profile) {
    return { success: false, error: 'Invalid or expired magic link' }
  }

  if (!profile.email) {
    return { success: false, error: 'Profile has no email address' }
  }

  const profileEmail = profile.email

  // Check if token is expired (7 days)
  const tokenAge = Date.now() - new Date(profile.updated_at || Date.now()).getTime()
  const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

  if (tokenAge > maxAge) {
    // Clear expired token
    await supabaseAdmin
      .from('profiles')
      .update({ activation_token: null })
      .eq('id', profile.id)

    return { success: false, error: 'This magic link has expired. Please request a new one.' }
  }

  try {
    // Update profile timestamps FIRST
    const now = new Date().toISOString()
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_login_at')
      .eq('id', profile.id)
      .single()

    await supabaseAdmin
      .from('profiles')
      .update({
        activation_token: null, // Invalidate token after use
        invitation_status: 'activated',
        last_login_at: now,
        first_login_at: existingProfile?.first_login_at || now,
      })
      .eq('id', profile.id)

    // Update survey invitation if survey provided
    if (surveyId) {
      await supabaseAdmin
        .from('survey_invitations')
        .update({
          status: 'clicked',
          clicked_at: now,
        })
        .eq('employee_id', profile.id)
        .eq('survey_id', surveyId)
    }

    // ✅ SIMPLE FIX: Set a temporary password and sign in
    // This is the most reliable way to create a session
    const tempPassword = `magic_${token.substring(0, 20)}_${Date.now()}`

    // Update user with temp password (admin can do this)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      {
        password: tempPassword,
        email_confirm: true, // Ensure email is confirmed
      }
    )

    if (updateError) {
      throw new Error(`Failed to set temp password: ${updateError.message}`)
    }

    // Now sign in with the temp password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profileEmail,
      password: tempPassword,
    })

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`)
    }

    // Revalidate to update any cached data
    revalidatePath('/', 'layout')

    return { success: true }
  } catch (error) {
    console.error('Magic link redemption error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to redeem magic link',
    }
  }
}
