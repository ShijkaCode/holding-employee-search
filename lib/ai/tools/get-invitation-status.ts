import { z } from 'zod'
import { ToolDefinition } from '@/lib/ai/tool-registry'

export interface InvitationStatusResult {
  survey_id: string
  survey_title: string
  total: number
  sent: number
  delivered: number
  clicked: number
  completed: number
  failed: number
  bounced: number
}

export const getInvitationStatusSchema = z.object({
  surveyId: z.string().uuid().optional(),
  title: z.string().min(2).optional(),
  latest: z.boolean().optional(),
})

export type GetInvitationStatusInput = z.infer<typeof getInvitationStatusSchema>

export function buildGetInvitationStatusTool(
  executor: (input: GetInvitationStatusInput) => Promise<InvitationStatusResult>
): ToolDefinition<GetInvitationStatusInput, InvitationStatusResult> {
  return {
    name: 'get_invitation_status',
    description: 'Get invitation delivery/click/completion status for a survey.',
    schema: getInvitationStatusSchema,
    execute: executor,
  }
}
