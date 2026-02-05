import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { token, surveyId } = await request.json()

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 400 }
      )
    }

    // Validate token using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, activation_token, updated_at')
      .eq('activation_token', token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired magic link' },
        { status: 401 }
      )
    }

    // Check if token is expired (7 days)
    const tokenAge = Date.now() - new Date(profile.updated_at || Date.now()).getTime()
    const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

    if (tokenAge > maxAge) {
      // Clear expired token
      await supabaseAdmin
        .from('profiles')
        .update({ activation_token: null })
        .eq('id', profile.id)

      return NextResponse.json(
        { success: false, error: 'This magic link has expired' },
        { status: 401 }
      )
    }

    // Update profile status
    const now = new Date().toISOString()
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_login_at')
      .eq('id', profile.id)
      .single()

    await supabaseAdmin
      .from('profiles')
      .update({
        activation_token: null, // Invalidate token
        invitation_status: 'activated',
        last_login_at: now,
        first_login_at: existingProfile?.first_login_at || now,
      })
      .eq('id', profile.id)

    // Update survey invitation if provided
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

    // Create temporary password for this session
    const tempPassword = `magic_${token.substring(0, 20)}_${Date.now()}`

    // Set temporary password via admin
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      {
        password: tempPassword,
        email_confirm: true,
      }
    )

    if (updateError) {
      console.error('Failed to set temp password:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Return credentials for client-side sign in
    return NextResponse.json({
      success: true,
      email: profile.email,
      tempPassword,
    })

  } catch (error) {
    console.error('Magic link validation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      },
      { status: 500 }
    )
  }
}
