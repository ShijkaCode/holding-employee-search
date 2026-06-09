import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { hashToken } from '@/lib/auth/magic-link'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const limit = await rateLimit({ key: `magic_link:${ip}`, max: 10, windowSeconds: 60 })
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please wait and try again.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const { token, surveyId } = (await request.json()) as { token?: string; surveyId?: string }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 400 }
      )
    }

    const tokenHashed = hashToken(token)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, activation_token_hash, activation_token_expires_at, invitation_consumed_at, first_login_at')
      .eq('activation_token_hash', tokenHashed)
      .single()

    if (profileError || !profile || !profile.email) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired magic link' },
        { status: 401 }
      )
    }

    if (profile.invitation_consumed_at) {
      return NextResponse.json(
        { success: false, error: 'This magic link has already been used' },
        { status: 401 }
      )
    }

    if (
      !profile.activation_token_expires_at ||
      new Date(profile.activation_token_expires_at).getTime() <= Date.now()
    ) {
      await supabaseAdmin
        .from('profiles')
        .update({
          activation_token_hash: null,
          activation_token_expires_at: null,
        })
        .eq('id', profile.id)

      return NextResponse.json(
        { success: false, error: 'This magic link has expired' },
        { status: 401 }
      )
    }

    const now = new Date().toISOString()

    // Mark token consumed atomically — clear hash so it cannot be reused.
    const { error: consumeError } = await supabaseAdmin
      .from('profiles')
      .update({
        activation_token_hash: null,
        activation_token_expires_at: null,
        invitation_consumed_at: now,
        invitation_status: 'activated',
        last_login_at: now,
        first_login_at: profile.first_login_at || now,
      })
      .eq('id', profile.id)
      .is('invitation_consumed_at', null) // defensive: double-redeem race

    if (consumeError) {
      return NextResponse.json(
        { success: false, error: 'Failed to redeem magic link' },
        { status: 500 }
      )
    }

    if (surveyId) {
      await supabaseAdmin
        .from('survey_invitations')
        .update({ status: 'clicked', clicked_at: now })
        .eq('employee_id', profile.id)
        .eq('survey_id', surveyId)
    }

    // Mint a real Supabase magic-link OTP; client redeems via verifyOtp.
    // No password mutation, no temp password leaked over the wire.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    })

    if (linkError || !linkData?.properties?.email_otp) {
      console.error('Failed to mint Supabase OTP:', linkError)
      return NextResponse.json(
        { success: false, error: 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      email: profile.email,
      otp: linkData.properties.email_otp,
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
