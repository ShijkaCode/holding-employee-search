import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params
    const { searchParams } = new URL(request.url)
    const companyIdFilter = searchParams.get('companyId')

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's profile to verify company and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
    }

    // Verify user has appropriate role
    if (!['admin', 'hr', 'specialist'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    // Fetch survey details
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, company_id, scope')
      .eq('id', surveyId)
      .single()

    if (surveyError || !survey) {
      console.error('Survey error:', surveyError)
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Permission check based on survey scope
    if (survey.scope === 'holding') {
      // Only admin and specialist can export holding surveys
      if (!['admin', 'specialist'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden: Only administrators and specialists can export holding surveys' }, { status: 403 })
      }
    } else {
      // For company surveys, verify user's company matches
      if (profile.role === 'hr' && profile.company_id !== survey.company_id) {
        return NextResponse.json({ error: 'Forbidden: Access denied to this survey' }, { status: 403 })
      }
    }

    // Determine which company to filter by
    const targetCompanyId = companyIdFilter || survey.company_id

    // Fetch company name
    let companyName = ''
    if (targetCompanyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', targetCompanyId)
        .single()
      companyName = company?.name || ''
    } else if (survey.scope === 'holding') {
      companyName = 'All Companies'
    }

    // Fetch questions ordered by section and question order
    const { data: questions, error: questionsError } = await supabase
      .from('survey_questions')
      .select('question_code, question_text, section_name')
      .eq('survey_id', surveyId)
      .order('section_order')
      .order('question_order')

    if (questionsError) {
      console.error('Questions error:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    // Fetch responses (without join to avoid RLS issues)
    let responsesQuery = supabase
      .from('survey_responses')
      .select('id, employee_id, company_id, answers, status, submitted_at')
      .eq('survey_id', surveyId)
      .eq('status', 'completed')

    // Filter by company if specified
    if (targetCompanyId) {
      responsesQuery = responsesQuery.eq('company_id', targetCompanyId)
    }

    const { data: responses, error: responsesError } = await responsesQuery

    if (responsesError) {
      console.error('Responses error:', responsesError)
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
    }

    // Fetch profiles separately for the employees who responded
    const employeeIds = responses?.map(r => r.employee_id) || []
    let profilesMap: Record<string, { full_name: string; email: string | null; org_unit_path: string | null }> = {}

    if (employeeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, org_unit_id')
        .in('id', employeeIds)

      // Fetch org unit paths for employees with org_unit_id
      const orgUnitIds = profiles?.map(p => p.org_unit_id).filter(Boolean) || []
      let orgPathsMap: Record<string, string> = {}

      if (orgUnitIds.length > 0) {
        const { data: orgHierarchy } = await (supabase as any)
          .from('org_hierarchy')
          .select('id, path_names')
          .in('id', orgUnitIds)

        orgHierarchy?.forEach((org: { id: string; path_names: string }) => {
          orgPathsMap[org.id] = org.path_names
        })
      }

      profiles?.forEach(p => {
        profilesMap[p.id] = {
          full_name: p.full_name,
          email: p.email,
          org_unit_path: p.org_unit_id ? (orgPathsMap[p.org_unit_id] || null) : null,
        }
      })
    }

    // Build CSV
    const questionCodes = questions?.map((q) => q.question_code) || []

    // CSV Header
    const headers = [
      'Company name',
      'Employee name',
      'Email',
      'Organization Unit',
      'Completion time',
      ...questionCodes,
    ]

    // CSV Rows
    const rows: string[][] = []

    responses?.forEach((response) => {
      const profile = profilesMap[response.employee_id]
      const answers = (response.answers as Record<string, string | string[]>) || {}

      const row = [
        cleanValue(companyName),
        cleanValue(profile?.full_name || ''),
        cleanValue(profile?.email || ''),
        cleanValue(profile?.org_unit_path || ''),
        response.submitted_at ? formatDate(response.submitted_at) : '',
        ...questionCodes.map((code) => {
          const answer = answers[code]
          if (Array.isArray(answer)) {
            return cleanValue(answer.join('; '))
          }
          return cleanValue(String(answer || ''))
        }),
      ]

      rows.push(row)
    })

    // Generate CSV content
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n')

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF'
    const csvWithBom = bom + csvContent

    // Return CSV file - use ASCII filename for header, UTF-8 encoded for filename*
    const safeFilename = `survey_export_${formatDateForFilename(new Date())}.csv`
    const utf8Filename = `${sanitizeFilename(survey.title)}_responses_${formatDateForFilename(new Date())}.csv`

    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// Helper functions
function cleanValue(value: string): string {
  if (!value) return ''
  return value.trim().replace(/\s+/g, ' ')
}

function escapeCSV(value: string): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0]
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u0400-\u04FF\u1800-\u18AF_-]/g, '_').substring(0, 50)
}
