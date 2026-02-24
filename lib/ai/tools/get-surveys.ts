import { z } from 'zod'
import { ToolDefinition } from '@/lib/ai/tool-registry'

export interface SurveyListItem {
  id: string
  title: string
  status: string
  scope: string | null
  deadline: string | null
  created_at: string | null
}

export interface SurveyListResult {
  total: number
  items: SurveyListItem[]
}

export const getSurveysSchema = z.object({
  status: z.enum(['draft', 'active', 'closed', 'all']).optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

export type GetSurveysInput = z.infer<typeof getSurveysSchema>

export function buildGetSurveysTool(
  executor: (input: GetSurveysInput) => Promise<SurveyListResult>
): ToolDefinition<GetSurveysInput, SurveyListResult> {
  return {
    name: 'get_surveys',
    description: 'List surveys by status (draft/active/closed).',
    schema: getSurveysSchema,
    execute: executor,
  }
}
