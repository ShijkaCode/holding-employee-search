import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { activateSurvey, closeSurvey, assignSurveyToCompanies } from '@/lib/ai/data-access'
import type { AIUserRole } from '@/lib/ai/types'

/** Untyped admin client for AI tables not in generated Database types */
function getUntypedAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface ConfirmActionRequest {
  actionId: string
  confirmed: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  const body = (await request.json()) as ConfirmActionRequest
  if (!body?.actionId) {
    return NextResponse.json({ error: 'Missing actionId' }, { status: 400 })
  }

  // Use untyped admin client for AI tables (not in generated Supabase types)
  const admin = getUntypedAdmin()

  const { data: task } = await admin
    .from('ai_tasks')
    .select('id, created_by, status, metadata')
    .eq('id', body.actionId)
    .single()

  if (!task || task.created_by !== user.id) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  // Handle cancellation
  if (!body.confirmed) {
    await admin
      .from('ai_tasks')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', body.actionId)
    await admin
      .from('ai_task_steps')
      .update({ status: 'skipped', updated_at: new Date().toISOString() })
      .eq('task_id', body.actionId)

    return NextResponse.json({ message: 'Action cancelled.' })
  }

  // Get the step details
  const { data: step } = await admin
    .from('ai_task_steps')
    .select('id, tool_name, input')
    .eq('task_id', body.actionId)
    .order('step_order', { ascending: true })
    .limit(1)
    .single()

  if (!step) {
    return NextResponse.json({ error: 'No steps found for action' }, { status: 400 })
  }

  const toolName = step.tool_name as string
  const input = step.input as Record<string, any> | null

  // Mark in progress
  await admin
    .from('ai_tasks')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', body.actionId)

  try {
    let result: any

    switch (toolName) {
      case 'send_reminders': {
        if (!input?.surveyId) {
          throw new Error('Invalid action input: missing surveyId')
        }
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
        const cookie = request.headers.get('cookie') || ''

        const response = await fetch(`${baseUrl}/api/surveys/${input.surveyId}/send-reminders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ employeeIds: input.employeeIds || [] }),
        })
        result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to send reminders')
        break
      }

      case 'activate_survey': {
        if (!input?.surveyId) throw new Error('Invalid action input: missing surveyId')
        const context = {
          userId: user.id,
          role: (profile?.role || 'hr') as AIUserRole,
          companyId: profile?.company_id || null,
        }
        result = await activateSurvey(supabase, context, { surveyId: input.surveyId })
        break
      }

      case 'close_survey': {
        if (!input?.surveyId) throw new Error('Invalid action input: missing surveyId')
        const context = {
          userId: user.id,
          role: (profile?.role || 'hr') as AIUserRole,
          companyId: profile?.company_id || null,
        }
        result = await closeSurvey(supabase, context, { surveyId: input.surveyId })
        break
      }

      case 'trigger_sentiment_analysis': {
        if (!input?.surveyId) throw new Error('Invalid action input: missing surveyId')
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
        const cookie = request.headers.get('cookie') || ''

        const response = await fetch(`${baseUrl}/api/surveys/${input.surveyId}/send-to-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({}),
        })
        result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to trigger sentiment analysis')
        break
      }

      case 'assign_survey_to_companies': {
        if (!input?.surveyId || !input?.companyIds) {
          throw new Error('Invalid action input: missing surveyId or companyIds')
        }
        const context = {
          userId: user.id,
          role: (profile?.role || 'hr') as AIUserRole,
          companyId: profile?.company_id || null,
        }
        result = await assignSurveyToCompanies(supabase, context, {
          surveyId: input.surveyId,
          companyIds: input.companyIds,
        })
        break
      }

      case 'send_survey_invitations': {
        if (!input?.surveyId) throw new Error('Invalid action input: missing surveyId')
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
        const cookie = request.headers.get('cookie') || ''

        const inviteResponse = await fetch(`${baseUrl}/api/surveys/${input.surveyId}/send-invitations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ companyId: input.companyId || null }),
        })
        result = await inviteResponse.json()
        if (!inviteResponse.ok) throw new Error(result.error || 'Failed to send invitations')
        break
      }

      default:
        throw new Error(`Unsupported action: ${toolName}`)
    }

    // Mark completed
    await admin
      .from('ai_tasks')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', body.actionId)
    await admin
      .from('ai_task_steps')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', step.id)

    const messages: Record<string, string> = {
      send_reminders: 'Reminders sent successfully.',
      activate_survey: 'Survey activated successfully.',
      close_survey: 'Survey closed successfully.',
      trigger_sentiment_analysis: 'Sentiment analysis triggered successfully.',
      assign_survey_to_companies: 'Survey assigned to companies successfully.',
      send_survey_invitations: 'Invitations sent successfully.',
    }

    return NextResponse.json({
      message: messages[toolName] || 'Action completed.',
      result,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Action failed'

    await admin
      .from('ai_tasks')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', body.actionId)
    await admin
      .from('ai_task_steps')
      .update({ status: 'failed', error: errorMessage, updated_at: new Date().toISOString() })
      .eq('id', step.id)

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
