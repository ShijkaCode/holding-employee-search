/**
 * Email Sending Service for Survey Invitations
 * Uses Supabase Auth or external email provider
 */

import { createClient } from '@/lib/supabase/server'
import { generateInvitationEmail, generateReminderEmail, getEmailSubject, type EmailTemplateData } from './templates'

export interface SendInvitationOptions {
  employeeId: string
  employeeName: string
  employeeEmail: string
  surveyId: string
  surveyTitle: string
  surveyDescription?: string
  magicLinkUrl: string
  deadline?: Date
  estimatedTime?: string
  companyName: string
  locale?: 'en' | 'mn'
  isReminder?: boolean
}

export interface SendInvitationResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send survey invitation email
 * Uses environment-configured email service
 */
export async function sendSurveyInvitation(
  options: SendInvitationOptions
): Promise<SendInvitationResult> {
  const {
    employeeId,
    employeeName,
    employeeEmail,
    surveyId,
    surveyTitle,
    surveyDescription,
    magicLinkUrl,
    deadline,
    estimatedTime,
    companyName,
    locale = 'en',
    isReminder = false,
  } = options

  try {
    // Prepare email template data
    const templateData: EmailTemplateData = {
      employeeName,
      surveyTitle,
      surveyDescription,
      magicLinkUrl,
      deadline: deadline ? formatDeadline(deadline, locale) : undefined,
      estimatedTime,
      companyName,
      locale,
    }

    // Generate HTML email
    const htmlContent = isReminder
      ? generateReminderEmail(templateData)
      : generateInvitationEmail(templateData)

    // Get subject line
    const subject = getEmailSubject(
      isReminder ? 'reminder' : 'invitation',
      surveyTitle,
      locale
    )

    // Send email using configured provider
    const result = await sendEmail({
      to: employeeEmail,
      subject,
      html: htmlContent,
      from: process.env.EMAIL_FROM || 'noreply@example.com',
    })

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email')
    }

    // ✅ FIX: Create or update survey invitation record using admin client
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const now = new Date().toISOString()

    // Check if invitation already exists
    const { data: existing } = await supabaseAdmin
      .from('survey_invitations')
      .select('id, retry_count')
      .eq('employee_id', employeeId)
      .eq('survey_id', surveyId)
      .maybeSingle()

    if (existing) {
      // Update existing invitation
      await supabaseAdmin
        .from('survey_invitations')
        .update({
          sent_at: now,
          status: 'sent',
          retry_count: isReminder ? (existing.retry_count || 0) + 1 : existing.retry_count,
          last_retry_at: isReminder ? now : undefined,
          updated_at: now,
        })
        .eq('id', existing.id)
    } else {
      // Create new invitation record
      // First, get assignment_id
      const { data: assignment } = await supabaseAdmin
        .from('survey_assignments')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('employee_id', employeeId)
        .single()

      if (assignment) {
        await supabaseAdmin
          .from('survey_invitations')
          .insert({
            assignment_id: assignment.id,
            employee_id: employeeId,
            survey_id: surveyId,
            method: 'email',
            sent_to: employeeEmail,
            sent_at: now,
            status: 'sent',
          })
      }
    }

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error) {
    console.error('Error sending invitation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invitation',
    }
  }
}

/**
 * Send email using configured provider
 * This is a wrapper that can use different email services
 */
async function sendEmail(options: {
  to: string
  subject: string
  html: string
  from: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, html, from } = options

  // Check which email service is configured
  const emailProvider = process.env.EMAIL_PROVIDER || 'console' // console, smtp, supabase, resend

  switch (emailProvider) {
    case 'console':
      // Development: Log to console with clear magic link for testing
      console.log('\n' + '='.repeat(60))
      console.log('📧 EMAIL INVITATION (Console Mode - POC Testing)')
      console.log('='.repeat(60))
      console.log('To:', to)
      console.log('Subject:', subject)
      console.log('From:', from)
      console.log('-'.repeat(60))
      // Extract magic link from HTML for easy copy
      const magicLinkMatch = html.match(/href="([^"]*magic-link[^"]*)"/)
      if (magicLinkMatch) {
        console.log('🔗 MAGIC LINK (copy this to test):')
        console.log(magicLinkMatch[1])
      }
      console.log('='.repeat(60) + '\n')
      return { success: true, messageId: 'console-' + Date.now() }

    case 'smtp':
      // SMTP (e.g., Gmail, SendGrid SMTP)
      return await sendViaSMTP(options)

    case 'supabase':
      // Supabase Auth email (limited features)
      return await sendViaSupabase(options)

    case 'resend':
      // Resend.com (recommended)
      return await sendViaResend(options)

    default:
      console.warn(`Unknown email provider: ${emailProvider}, falling back to console`)
      return sendEmail({ ...options })
  }
}

/**
 * Send via SMTP (e.g., Gmail, SendGrid)
 */
async function sendViaSMTP(options: {
  to: string
  subject: string
  html: string
  from: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Use nodemailer for SMTP
    const nodemailer = await import('nodemailer')

    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    const info = await transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('SMTP send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMTP send failed',
    }
  }
}

/**
 * Send via Supabase Auth (basic email)
 */
async function sendViaSupabase(options: {
  to: string
  subject: string
  html: string
  from: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Note: Supabase Auth doesn't support custom HTML emails directly
    // This is a placeholder - in production, use SMTP or Resend
    console.warn('Supabase email sending has limited HTML support')

    // For now, just mark as sent
    return { success: true, messageId: 'supabase-' + Date.now() }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Supabase send failed',
    }
  }
}

/**
 * Send via Resend.com (recommended)
 */
async function sendViaResend(options: {
  to: string
  subject: string
  html: string
  from: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Resend API error')
    }

    return { success: true, messageId: data.id }
  } catch (error) {
    console.error('Resend send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Resend send failed',
    }
  }
}

/**
 * Format deadline date for email
 */
function formatDeadline(deadline: Date, locale: 'en' | 'mn'): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }

  if (locale === 'mn') {
    return deadline.toLocaleDateString('mn-MN', options)
  }

  return deadline.toLocaleDateString('en-US', options)
}

/**
 * Batch send invitations with rate limiting
 */
export async function batchSendInvitations(
  invitations: SendInvitationOptions[],
  batchSize: number = 10,
  delayMs: number = 1000
): Promise<{
  total: number
  sent: number
  failed: number
  errors: { email: string; error: string }[]
}> {
  const results = {
    total: invitations.length,
    sent: 0,
    failed: 0,
    errors: [] as { email: string; error: string }[],
  }

  // Process in batches
  for (let i = 0; i < invitations.length; i += batchSize) {
    const batch = invitations.slice(i, i + batchSize)

    // Send batch in parallel
    const batchResults = await Promise.all(
      batch.map((invitation) => sendSurveyInvitation(invitation))
    )

    // Count results
    batchResults.forEach((result, index) => {
      if (result.success) {
        results.sent++
      } else {
        results.failed++
        results.errors.push({
          email: batch[index].employeeEmail,
          error: result.error || 'Unknown error',
        })
      }
    })

    // Delay between batches (rate limiting)
    if (i + batchSize < invitations.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return results
}
