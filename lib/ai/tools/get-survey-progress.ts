import { z } from 'zod'
import { ToolDefinition } from '@/lib/ai/tool-registry'

export interface SurveyProgressRow {
  survey_id: string
  title: string
  status: string
  scope: string | null
  company_id: string | null
  total_assigned: number
  total_completed: number
  completion_rate: number
}

export interface SurveyProgressResult {
  summary: {
    survey_id: string
    title: string
    status: string
    scope: string | null
    total_assigned: number
    total_completed: number
    completion_rate: number
  }
  by_company?: {
    company_id: string
    company_name: string
    total_assigned: number
    total_completed: number
    completion_rate: number
  }[]
}

export const getSurveyProgressSchema = z.object({
  surveyId: z.string().uuid().optional(),
  title: z.string().min(2).optional(),
  latest: z.boolean().optional(),
})

export type GetSurveyProgressInput = z.infer<typeof getSurveyProgressSchema>

export function buildGetSurveyProgressTool(
  executor: (input: GetSurveyProgressInput) => Promise<SurveyProgressResult>
): ToolDefinition<GetSurveyProgressInput, SurveyProgressResult> {
  return {
    name: 'get_survey_progress',
    description: 'Fetch survey completion progress by survey id or title.',
    schema: getSurveyProgressSchema,
    execute: executor,
  }
}
