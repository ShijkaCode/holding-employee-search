import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateMagicLink } from '@/lib/auth/magic-link'
import { batchSendInvitations, type SendInvitationOptions } from '@/lib/email/send-invitation'

export const maxDuration = 300 // 5 minutes for large batches

interface SendInvitationsRequest {
  employeeIds?: string[] // Specific employees, or all if not provided
  method?: 'email' | 'sms' // Phase 3: email only, Phase 4: SMS
  companyId?: string // Filter by company (for holding surveys)
}

interface SendInvitationsResponse {
  success: boolean
  results?: {
    total: number
    sent: number
    failed: number
    errors: { email: string; error: string }[]
  }
  error?: string
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse<SendInvitationsResponse>> {
  try {
    const { id: surveyId } = await context.params

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

    // Get survey details using Admin to bypass RLS
    // We will verify permissions manually below
    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('surveys')
      .select('id, title, description, deadline, company_id, scope, status')
      .eq('id', surveyId)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ success: false, error: 'Survey not found' }, { status: 404 })
    }

    // Verify permissions based on survey scope
    if (survey.scope === 'holding') {
      // Only admin and specialist can send holding survey invitations
      if (!['admin', 'specialist'].includes(profile.role)) {
        return NextResponse.json(
          { success: false, error: 'Only administrators and specialists can send holding survey invitations' },
          { status: 403 }
        )
      }
    } else {
      // For company surveys, verify company_id matches
      if (profile.role === 'hr' && profile.company_id !== survey.company_id) {
        return NextResponse.json(
          { success: false, error: 'You can only send invitations for surveys in your company' },
          { status: 403 }
        )
      }
    }

    // Parse request body
    const body: SendInvitationsRequest = await request.json()
    const { employeeIds, method = 'email', companyId } = body

    // Phase 3: Only email supported
    if (method === 'sms') {
      return NextResponse.json(
        { success: false, error: 'SMS invitations will be available in Phase 4' },
        { status: 400 }
      )
    }

    // Get employees to send invitations to
    let query = supabase
      .from('survey_assignments')
      .select(`
        id,
        employee_id,
        profile:profiles!survey_assignments_employee_id_fkey(
          id,
          full_name,
          email,
          company_id,
          companies(name)
        )
      `)
      .eq('survey_id', surveyId)

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('employee_id', employeeIds)
    }

    const { data: assignments, error: assignmentsError } = await query

    // Filter by company if specified (for holding surveys)
    let filteredAssignments = assignments || []
    if (companyId && filteredAssignments.length > 0) {
      filteredAssignments = filteredAssignments.filter(assignment => {
        const employee = Array.isArray(assignment.profile) ? assignment.profile[0] : assignment.profile
        return employee?.company_id === companyId
      })
    }

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`)
    }

    if (!filteredAssignments || filteredAssignments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No employees found for this survey' },
        { status: 400 }
      )
    }

    // Prepare invitations
    const invitations: SendInvitationOptions[] = []

    for (const assignment of filteredAssignments) {
      const employee = Array.isArray(assignment.profile)
        ? assignment.profile[0]
        : assignment.profile

      if (!employee || !employee.email) {
        console.warn(`Skipping employee ${assignment.employee_id}: no email`)
        continue
      }

      // Generate magic link for this employee
      const magicLink = await generateMagicLink({
        employeeId: employee.id,
        surveyId: survey.id,
        email: employee.email,
        locale: 'en', // TODO: Get from user preferences
      })

      // Get company name
      const companyData = Array.isArray(employee.companies)
        ? employee.companies[0]
        : employee.companies
      const companyName = companyData?.name || 'Your Company'

      invitations.push({
        employeeId: employee.id,
        employeeName: employee.full_name,
        employeeEmail: employee.email,
        surveyId: survey.id,
        surveyTitle: survey.title,
        surveyDescription: survey.description || undefined,
        magicLinkUrl: magicLink.url,
        deadline: survey.deadline ? new Date(survey.deadline) : undefined,
        estimatedTime: '10-15 minutes', // TODO: Calculate from questions
        companyName,
        locale: 'en', // TODO: Get from user preferences
        isReminder: false,
      })
    }

    // Send invitations in batches
    const results = await batchSendInvitations(invitations, 10, 1000)

    return NextResponse.json({
      success: true,
      results,
    })

  } catch (error) {
    console.error('Error sending invitations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invitations',
      },
      { status: 500 }
    )
  }
}
