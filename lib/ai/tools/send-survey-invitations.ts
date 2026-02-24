import { z } from 'zod'

export interface SendSurveyInvitationsResult {
  survey_id: string
  survey_title: string
  invitations_sent: number
}

export const sendSurveyInvitationsSchema = z.object({
  surveyId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
})

export type SendSurveyInvitationsInput = z.infer<typeof sendSurveyInvitationsSchema>
