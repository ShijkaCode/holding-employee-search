import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { batchSendInvitations, type SendInvitationOptions } from '@/lib/email/send-invitation'

export const maxDuration = 300 // 5 minutes

const MAX_REMINDERS_PER_EMPLOYEE = 3
const MIN_HOURS_BETWEEN_REMINDERS = 24

interface SendRemindersRequest {
  employeeIds?: string[] // Specific employees, or all incomplete if not provided
  locale?: 'en' | 'mn'
}

function normalizeLocale(value: unknown): 'en' | 'mn' {
  return value === 'mn' ? 'mn' : 'en'
}

interface SendRemindersResponse {
  success: boolean
  results?: {
    total: number
    sent: number
    skipped: number
    failed: number
    reasons: {
      maxReminders: number
      tooSoon: number
      alreadyCompleted: number
    }
    errors: { email: string; error: string }[]
  }
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SendRemindersResponse>> {
  try {
    const { id: surveyId } = await params
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile and verify role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'specialist', 'hr'].includes(profile.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    // Get survey details
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, description, deadline, company_id, scope, status')
      .eq('id', surveyId)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ success: false, error: 'Survey not found' }, { status: 404 })
    }

    // Verify permissions based on survey scope
    if (survey.scope === 'holding') {
      // Only admin and specialist can send holding survey reminders
      if (!['admin', 'specialist'].includes(profile.role)) {
        return NextResponse.json(
          { success: false, error: 'Only administrators and specialists can send reminders for holding surveys' },
          { status: 403 }
        )
      }
    } else {
      // For company surveys, verify company_id matches
      if (profile.role === 'hr' && profile.company_id !== survey.company_id) {
        return NextResponse.json(
          { success: false, error: 'You can only send reminders for surveys in your company' },
          { status: 403 }
        )
      }
    }

    // Parse request body
    const body: SendRemindersRequest = await request.json()
    const { employeeIds } = body
    const locale = normalizeLocale(body.locale)

    // Base population = everyone ASSIGNED to the survey, not just those who
    // already have a survey_responses row. Employees who never opened the
    // survey have no response row at all, so a response-based query would
    // silently skip exactly the people who most need a reminder.
    let assignmentQuery = supabase
      .from('survey_assignments')
      .select(`
        employee_id,
        profile:profiles!survey_assignments_employee_id_fkey(
          id,
          full_name,
          email,
          company_id,
          companies(name),
          invitation_consumed_at
        )
      `)
      .eq('survey_id', surveyId)

    if (employeeIds && employeeIds.length > 0) {
      assignmentQuery = assignmentQuery.in('employee_id', employeeIds)
    }

    const { data: assignments, error: assignmentsError } = await assignmentQuery

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`)
    }

    // Look up who has already completed so we can exclude them.
    const { data: responseRows, error: responsesError } = await supabase
      .from('survey_responses')
      .select('employee_id, status')
      .eq('survey_id', surveyId)

    if (responsesError) {
      throw new Error(`Failed to fetch responses: ${responsesError.message}`)
    }

    const statusByEmployee = new Map(
      (responseRows || []).map((r) => [r.employee_id, r.status])
    )

    // Incomplete = assigned AND not completed. Never-started employees (no
    // response row) are included with an implicit "pending" status.
    const incompleteResponses = (assignments || [])
      .filter((a) => statusByEmployee.get(a.employee_id) !== 'completed')
      .map((a) => ({
        employee_id: a.employee_id,
        status: statusByEmployee.get(a.employee_id) ?? 'pending',
        profile: a.profile,
      }))

    // Get invitation history for reminder limits
    const { data: invitations } = await supabase
      .from('survey_invitations')
      .select('employee_id, retry_count, last_retry_at, sent_at')
      .eq('survey_id', surveyId)

    const invitationMap = new Map(
      (invitations || []).map(inv => [
        inv.employee_id,
        {
          retryCount: inv.retry_count || 0,
          lastRetryAt: inv.last_retry_at || inv.sent_at,
        },
      ])
    )

    // Prepare reminders
    const reminders: SendInvitationOptions[] = []
    const results = {
      total: incompleteResponses?.length || 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      reasons: {
        maxReminders: 0,
        tooSoon: 0,
        alreadyCompleted: 0,
      },
      errors: [] as { email: string; error: string }[],
    }

    for (const response of incompleteResponses || []) {
      const employee = Array.isArray(response.profile)
        ? response.profile[0]
        : response.profile

      if (!employee || !employee.email) {
        console.warn(`Skipping employee ${response.employee_id}: no email`)
        results.skipped++
        continue
      }

      // Check if employee already completed
      if (response.status === 'completed') {
        results.skipped++
        results.reasons.alreadyCompleted++
        continue
      }

      // Check reminder limits
      const invitationInfo = invitationMap.get(response.employee_id)

      if (invitationInfo) {
        // Check max reminders
        if (invitationInfo.retryCount >= MAX_REMINDERS_PER_EMPLOYEE) {
          console.log(`Skipping ${employee.email}: max reminders reached`)
          results.skipped++
          results.reasons.maxReminders++
          continue
        }

        // Check minimum time between reminders
        if (invitationInfo.lastRetryAt) {
          const hoursSinceLastReminder =
            (Date.now() - new Date(invitationInfo.lastRetryAt).getTime()) / (1000 * 60 * 60)

          if (hoursSinceLastReminder < MIN_HOURS_BETWEEN_REMINDERS) {
            console.log(`Skipping ${employee.email}: too soon since last reminder`)
            results.skipped++
            results.reasons.tooSoon++
            continue
          }
        }
      }

      // Skip if employee already activated their account on this invite cycle.
      if (employee.invitation_consumed_at) {
        results.skipped++
        results.reasons.alreadyCompleted++
        continue
      }

      // Get company name
      const companyData = Array.isArray(employee.companies)
        ? employee.companies[0]
        : employee.companies
      const companyName = companyData?.name || 'Your Company'

      // Issue a fresh magic link for every reminder. The previous token is replaced.
      const { url: magicLinkUrl } = await generateMagicLink({
        employeeId: employee.id,
        surveyId: survey.id,
        email: employee.email,
        locale,
      })

      reminders.push({
        employeeId: employee.id,
        employeeName: employee.full_name,
        employeeEmail: employee.email,
        surveyId: survey.id,
        surveyTitle: survey.title,
        surveyDescription: survey.description || undefined,
        magicLinkUrl,
        deadline: survey.deadline ? new Date(survey.deadline) : undefined,
        companyName,
        locale,
        isReminder: true,
      })
    }

    // Send reminders in batches
    if (reminders.length > 0) {
      const sendResults = await batchSendInvitations(reminders, 10, 1000)
      results.sent = sendResults.sent
      results.failed += sendResults.failed
      results.errors.push(...sendResults.errors)
    }

    return NextResponse.json({
      success: true,
      results,
    })

  } catch (error) {
    console.error('Error sending reminders:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reminders',
      },
      { status: 500 }
    )
  }
}
