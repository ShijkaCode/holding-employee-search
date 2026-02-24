import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgent } from '@/lib/ai/agent'
import {
  getSurveyProgress,
  getNonRespondents,
  getInvitationStatus,
  getSurveys,
  activateSurvey,
  closeSurvey,
  getReportData,
  triggerSentimentAnalysis,
  getSentimentResults,
  getCompanies,
  createSurvey,
  addSurveyQuestions,
  assignSurveyToCompanies,
} from '@/lib/ai/data-access'
import {
  createPendingTask,
  getOrCreateSession,
  getSessionMessages,
  logMessage,
  logToolRun,
  updateSessionActivity,
  updateToolRun,
} from '@/lib/ai/session-store'
import type { ChatRequest, ChatContext, AIUserRole } from '@/lib/ai/types'
import type { ToolExecutors } from '@/lib/ai/tools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function sseEncode(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response(sseEncode({ type: 'error', message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'specialist', 'hr'].includes(profile.role)) {
    return new Response(sseEncode({ type: 'error', message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  let payload: ChatRequest
  try {
    payload = await request.json()
  } catch {
    return new Response(sseEncode({ type: 'error', message: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const message = (payload.message || '').trim()
  if (!message) {
    return new Response(sseEncode({ type: 'error', message: 'Message cannot be empty' }), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const context: ChatContext = {
    userId: user.id,
    role: profile.role as AIUserRole,
    companyId: profile.company_id || null,
    locale: payload.locale || null,
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sseEncode(data)))

      try {
        const sessionId = await getOrCreateSession(supabase, context, payload.sessionId || null)

        await updateSessionActivity(supabase, sessionId)
        await logMessage({
          supabase,
          sessionId,
          role: 'user',
          content: message,
        })

        // Load conversation history for multi-turn context
        const history = await getSessionMessages(supabase, sessionId, 20)
        // Remove the last message since we just logged it and will pass it separately
        if (history.length > 0) {
          const lastMsg = history[history.length - 1]
          if (lastMsg.role === 'user' && lastMsg.content === message) {
            history.pop()
          }
        }

        // Helper to create a confirmable action with pending task
        const createConfirmable = async (
          type: string,
          surveyId: string,
          message: string,
          toolInput?: unknown
        ) => {
          const { taskId } = await createPendingTask({
            supabase,
            sessionId,
            createdBy: context.userId,
            companyId: context.companyId,
            title: message,
            goal: message,
            toolName: type,
            input: toolInput || { surveyId },
          })
          return {
            action: 'pending_confirmation' as const,
            taskId,
            type: type as any,
            surveyId,
            message,
          }
        }

        // Build tool executors bound to this request's supabase client and context
        const executors: ToolExecutors = {
          get_survey_progress: (input) => getSurveyProgress(supabase, context, input),
          get_non_respondents: (input) => getNonRespondents(supabase, context, input),
          get_invitation_status: (input) => getInvitationStatus(supabase, context, input),
          get_surveys: (input) => getSurveys(supabase, context, input),
          get_report_data: (input) => getReportData(supabase, context, input),
          get_sentiment_results: (input) => getSentimentResults(supabase, context, input),

          send_reminders: async (input) => {
            const nonRespondents = await getNonRespondents(supabase, context, input)
            const employeeIds = nonRespondents.employees.map((e) => e.employee_id)

            if (employeeIds.length === 0) {
              return {
                survey_id: nonRespondents.survey_id,
                survey_title: nonRespondents.survey_title,
                message: `Everyone has completed "${nonRespondents.survey_title}". No reminders needed.`,
                reminders_needed: 0,
              }
            }

            return createConfirmable(
              'send_reminders',
              nonRespondents.survey_id,
              `Send reminders to ${employeeIds.length} employees for "${nonRespondents.survey_title}".`,
              { surveyId: nonRespondents.survey_id, employeeIds }
            )
          },

          activate_survey: async (input) => {
            // Pre-validate before creating confirmation
            const result = await getSurveyProgress(supabase, context, input)
            const survey = result.summary
            if (survey.status !== 'draft') {
              throw new Error(`Cannot activate "${survey.title}" — it is currently "${survey.status}". Only draft surveys can be activated.`)
            }
            return createConfirmable(
              'activate_survey',
              survey.survey_id,
              `Activate survey "${survey.title}" (change status from draft to active).`
            )
          },

          close_survey: async (input) => {
            const result = await getSurveyProgress(supabase, context, input)
            const survey = result.summary
            if (survey.status !== 'active') {
              throw new Error(`Cannot close "${survey.title}" — it is currently "${survey.status}". Only active surveys can be closed.`)
            }
            return createConfirmable(
              'close_survey',
              survey.survey_id,
              `Close survey "${survey.title}" (${survey.total_completed}/${survey.total_assigned} completed, ${survey.completion_rate}% rate). No more responses will be accepted.`
            )
          },

          trigger_sentiment_analysis: async (input) => {
            const result = await triggerSentimentAnalysis(supabase, context, input)
            if (result.status !== 'ready') {
              // Already in progress — return informational result, not confirmable
              return {
                survey_id: result.survey_id,
                survey_title: result.survey_title,
                analysis_id: result.analysis_id,
                status: result.status,
                message: result.message,
              }
            }
            return createConfirmable(
              'trigger_sentiment_analysis',
              result.survey_id,
              `Run sentiment analysis on ${result.responses_count} responses for "${result.survey_title}".`
            )
          },

          // --- Phase 3: Survey creation workflow ---
          get_companies: (input) => getCompanies(supabase, context, input),
          create_survey: (input) => createSurvey(supabase, context, input),
          add_survey_questions: (input) => addSurveyQuestions(supabase, context, input),

          assign_survey_to_companies: async (input) => {
            // Pre-validate: survey must be holding scope and draft
            const { data: survey } = await supabase
              .from('surveys')
              .select('id, title, status, scope')
              .eq('id', input.surveyId)
              .single()

            if (!survey) throw new Error('Survey not found.')
            if (survey.scope !== 'holding') {
              throw new Error(`Survey "${survey.title}" is company-scope. Only holding-scope surveys can be assigned to multiple companies.`)
            }
            if (survey.status !== 'draft') {
              throw new Error(`Cannot assign companies to survey "${survey.title}" — it is currently "${survey.status}". Only draft surveys can be assigned.`)
            }

            // Get company names and employee counts for confirmation message
            const { data: companies } = await supabase
              .from('companies')
              .select('id, name')
              .in('id', input.companyIds)

            const companyNames = (companies || []).map((c: any) => c.name).join(', ')

            const { data: employees } = await supabase
              .from('profiles')
              .select('id')
              .in('company_id', input.companyIds)
              .eq('role', 'employee')

            const employeeCount = (employees || []).length

            return createConfirmable(
              'assign_survey_to_companies',
              survey.id,
              `Assign survey "${survey.title}" to ${input.companyIds.length} companies (${companyNames}). This will create assignments for ~${employeeCount} employees.`,
              { surveyId: input.surveyId, companyIds: input.companyIds }
            )
          },

          send_survey_invitations: async (input) => {
            // Validate survey is active
            const { data: survey } = await supabase
              .from('surveys')
              .select('id, title, status')
              .eq('id', input.surveyId)
              .single()

            if (!survey) throw new Error('Survey not found.')
            if (survey.status !== 'active') {
              throw new Error(`Cannot send invitations for survey "${survey.title}" — it is currently "${survey.status}". Only active surveys can have invitations sent.`)
            }

            // Count assignments
            let assignmentQuery = supabase
              .from('survey_assignments')
              .select('id', { count: 'exact', head: true })
              .eq('survey_id', input.surveyId)

            if (input.companyId) {
              const { data: companyEmployees } = await supabase
                .from('profiles')
                .select('id')
                .eq('company_id', input.companyId)
                .eq('role', 'employee')
              const empIds = (companyEmployees || []).map((e: any) => e.id)
              if (empIds.length > 0) {
                assignmentQuery = assignmentQuery.in('employee_id', empIds)
              }
            }

            const { count } = await assignmentQuery
            const assignmentCount = count || 0

            if (assignmentCount === 0) {
              throw new Error(`No employee assignments found for survey "${survey.title}". Assign companies first.`)
            }

            return createConfirmable(
              'send_survey_invitations',
              survey.id,
              `Send email invitations to ${assignmentCount} employees for survey "${survey.title}".`,
              { surveyId: input.surveyId, companyId: input.companyId || null }
            )
          },
        }

        const startedAt = Date.now()
        const result = await runAgent({
          message,
          history,
          executors,
          locale: context.locale,
        })
        const latencyMs = Date.now() - startedAt

        // Log tool runs
        for (const toolRun of result.toolRuns) {
          const toolRunId = await logToolRun({
            supabase,
            sessionId,
            toolName: toolRun.toolName,
            input: toolRun.input,
            status: 'running',
            startedAt: new Date().toISOString(),
          })

          if (toolRun.output) {
            await logMessage({
              supabase,
              sessionId,
              role: 'tool',
              content: null,
              toolName: toolRun.toolName,
              toolInput: toolRun.input,
              toolOutput: toolRun.output,
            })
            send({ type: 'tool_result', tool: toolRun.toolName, data: toolRun.output })
          }

          if (toolRunId) {
            await updateToolRun({
              supabase,
              toolRunId,
              status: toolRun.output ? 'succeeded' : 'failed',
              output: toolRun.output || null,
              completedAt: new Date().toISOString(),
              latencyMs,
            })
          }
        }

        // Log assistant response
        await logMessage({
          supabase,
          sessionId,
          role: 'assistant',
          content: result.text,
          tokensIn: result.tokensIn || null,
          tokensOut: result.tokensOut || null,
          latencyMs,
        })

        send({ type: 'text', content: result.text })
        if (result.actionPending) {
          send({ type: 'action_pending', action: result.actionPending })
        }
        send({ type: 'done', sessionId })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error'
        send({ type: 'error', message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
