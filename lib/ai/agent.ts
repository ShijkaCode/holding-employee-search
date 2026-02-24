import { getClient, DEFAULT_MODEL } from '@/lib/ai/claude'
import { TOOL_DEFINITIONS, isValidToolName, CONFIRMABLE_TOOLS } from '@/lib/ai/tools'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { SurveyNotFoundError } from '@/lib/ai/data-access'
import { getSurveyProgressSchema } from '@/lib/ai/tools/get-survey-progress'
import { getNonRespondentsSchema } from '@/lib/ai/tools/get-non-respondents'
import { getInvitationStatusSchema } from '@/lib/ai/tools/get-invitation-status'
import { getSurveysSchema } from '@/lib/ai/tools/get-surveys'
import { getCompaniesSchema } from '@/lib/ai/tools/get-companies'
import { createSurveySchema } from '@/lib/ai/tools/create-survey'
import { addSurveyQuestionsSchema } from '@/lib/ai/tools/add-survey-questions'
import { assignSurveyToCompaniesSchema } from '@/lib/ai/tools/assign-survey-to-companies'
import { sendSurveyInvitationsSchema } from '@/lib/ai/tools/send-survey-invitations'
import { z } from 'zod'
import type { MessageParam, ContentBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { ToolExecutors, ConfirmableActionType, ToolName } from '@/lib/ai/tools'

// Zod schema for tools that use survey lookup
const surveyLookupSchema = z.object({
  surveyId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  latest: z.boolean().optional(),
})

const TOOL_SCHEMAS: Record<ToolName, z.ZodTypeAny> = {
  get_survey_progress: getSurveyProgressSchema,
  get_non_respondents: getNonRespondentsSchema,
  get_invitation_status: getInvitationStatusSchema,
  get_surveys: getSurveysSchema,
  send_reminders: surveyLookupSchema,
  activate_survey: surveyLookupSchema,
  close_survey: surveyLookupSchema,
  get_report_data: surveyLookupSchema,
  trigger_sentiment_analysis: surveyLookupSchema,
  get_sentiment_results: surveyLookupSchema,
  get_companies: getCompaniesSchema,
  create_survey: createSurveySchema,
  add_survey_questions: addSurveyQuestionsSchema,
  assign_survey_to_companies: assignSurveyToCompaniesSchema,
  send_survey_invitations: sendSurveyInvitationsSchema,
}

export interface AgentToolRun {
  toolName: string
  input: unknown
  output?: unknown
}

export interface AgentPendingAction {
  id: string
  type: ConfirmableActionType
  surveyId: string
  message: string
  metadata?: Record<string, unknown>
}

export interface AgentResult {
  text: string
  toolRuns: AgentToolRun[]
  actionPending?: AgentPendingAction
  tokensIn?: number
  tokensOut?: number
}

/** Standardized shape returned by any confirmable tool executor */
export interface ConfirmableToolResult {
  action: 'pending_confirmation'
  taskId: string
  type: ConfirmableActionType
  surveyId: string
  message: string
  metadata?: Record<string, unknown>
}

function isConfirmableResult(result: unknown): result is ConfirmableToolResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'action' in result &&
    (result as any).action === 'pending_confirmation'
  )
}

const MAX_TOOL_ROUNDS = 8

export async function runAgent({
  message,
  history,
  executors,
  locale,
}: {
  message: string
  history: MessageParam[]
  executors: ToolExecutors
  locale?: string | null
}): Promise<AgentResult> {
  const client = getClient()
  const systemPrompt = buildSystemPrompt(locale)

  const messages: MessageParam[] = [
    ...history,
    { role: 'user', content: message },
  ]

  const toolRuns: AgentToolRun[] = []
  let pendingAction: AgentPendingAction | undefined

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages,
      tools: TOOL_DEFINITIONS,
    })

    const toolUseBlocks = response.content.filter(
      (block): block is Extract<ContentBlock, { type: 'tool_use' }> =>
        block.type === 'tool_use'
    )

    if (toolUseBlocks.length === 0) {
      const text = response.content
        .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
        .map((block) => block.text)
        .join('')

      return {
        text: text || fallbackResponse(locale),
        toolRuns,
        actionPending: pendingAction,
        tokensIn: response.usage?.input_tokens,
        tokensOut: response.usage?.output_tokens,
      }
    }

    messages.push({ role: 'assistant', content: response.content })

    const toolResults: ToolResultBlockParam[] = []

    for (const toolBlock of toolUseBlocks) {
      const { id: toolUseId, name: toolName, input } = toolBlock

      if (!isValidToolName(toolName)) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: `Unknown tool: ${toolName}`,
          is_error: true,
        })
        continue
      }

      try {
        const schema = TOOL_SCHEMAS[toolName]
        const parsed = schema.parse(input)
        const executor = executors[toolName]
        const result = await executor(parsed as any)

        const toolRun: AgentToolRun = { toolName, input, output: result }
        toolRuns.push(toolRun)

        // Any confirmable tool returns a standardized ConfirmableToolResult
        if (isConfirmableResult(result)) {
          pendingAction = {
            id: result.taskId,
            type: result.type,
            surveyId: result.surveyId,
            message: result.message,
            metadata: result.metadata,
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: JSON.stringify({
              status: 'pending_confirmation',
              message: result.message,
              ...result.metadata,
            }),
          })
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: JSON.stringify(result),
          })
        }
      } catch (error) {
        toolRuns.push({ toolName, input })

        if (error instanceof z.ZodError) {
          const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: `Invalid input: ${issues}`,
            is_error: true,
          })
          continue
        }

        if (error instanceof SurveyNotFoundError) {
          const msg = error.suggestions.length > 0
            ? `Survey not found. Similar surveys: ${error.suggestions.join(', ')}`
            : 'Survey not found. Please provide a valid survey name or ID.'
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: msg,
            is_error: true,
          })
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: error instanceof Error ? error.message : 'Tool execution failed',
            is_error: true,
          })
        }
      }
    }

    messages.push({ role: 'user', content: toolResults })

    // If there's a pending action, get Claude to generate a confirmation message and stop
    if (pendingAction) {
      const finalResponse = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: TOOL_DEFINITIONS,
      })

      const text = finalResponse.content
        .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
        .map((block) => block.text)
        .join('')

      return {
        text: text || pendingAction.message,
        toolRuns,
        actionPending: pendingAction,
        tokensIn: (response.usage?.input_tokens || 0) + (finalResponse.usage?.input_tokens || 0),
        tokensOut: (response.usage?.output_tokens || 0) + (finalResponse.usage?.output_tokens || 0),
      }
    }
  }

  return {
    text: fallbackResponse(locale),
    toolRuns,
    actionPending: pendingAction,
  }
}

function fallbackResponse(locale?: string | null): string {
  return locale === 'mn'
    ? 'Уучлаарай, хүсэлтийг боловсруулж чадсангүй. Дахин оролдоно уу.'
    : 'Sorry, I could not process your request. Please try again.'
}
