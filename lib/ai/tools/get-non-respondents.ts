import { z } from 'zod'
import { ToolDefinition } from '@/lib/ai/tool-registry'

export interface NonRespondent {
  employee_id: string
  full_name: string
  email: string | null
  department: string | null
  response_status: string
}

export interface NonRespondentsResult {
  survey_id: string
  survey_title: string
  count: number
  employees: NonRespondent[]
}

export const getNonRespondentsSchema = z.object({
  surveyId: z.string().uuid().optional(),
  title: z.string().min(2).optional(),
  latest: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
})

export type GetNonRespondentsInput = z.infer<typeof getNonRespondentsSchema>

export function buildGetNonRespondentsTool(
  executor: (input: GetNonRespondentsInput) => Promise<NonRespondentsResult>
): ToolDefinition<GetNonRespondentsInput, NonRespondentsResult> {
  return {
    name: 'get_non_respondents',
    description: 'Fetch employees who have not completed a survey.',
    schema: getNonRespondentsSchema,
    execute: executor,
  }
}
