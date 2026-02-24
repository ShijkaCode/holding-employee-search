import { z } from 'zod'

export interface AssignSurveyToCompaniesResult {
  survey_id: string
  survey_title: string
  companies_assigned: number
  employees_assigned: number
  company_details: {
    company_id: string
    company_name: string
    employee_count: number
  }[]
}

export const assignSurveyToCompaniesSchema = z.object({
  surveyId: z.string().uuid(),
  companyIds: z.array(z.string().uuid()).min(1),
})

export type AssignSurveyToCompaniesInput = z.infer<typeof assignSurveyToCompaniesSchema>
