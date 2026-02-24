import { z } from 'zod'

export interface CreateSurveyResult {
  survey_id: string
  title: string
  scope: string
  status: string
  description: string | null
  deadline: string | null
}

export const createSurveySchema = z.object({
  title: z.string().min(2).max(200),
  scope: z.enum(['holding', 'company']).optional().default('holding'),
  description: z.string().max(2000).optional(),
  deadline: z.string().optional(),
  companyId: z.string().uuid().optional(),
})

export type CreateSurveyInput = z.infer<typeof createSurveySchema>
