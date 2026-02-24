import { z } from 'zod'

const questionSchema = z.object({
  question_code: z.string().min(1).max(50),
  question_text: z.string().min(2).max(1000),
  type: z.enum(['text', 'scale', 'multiple_choice', 'single_choice', 'rating', 'date']),
  options: z.array(z.string()).optional(),
  section_name: z.string().max(200).optional(),
  is_required: z.boolean().optional().default(true),
  description: z.string().max(500).optional(),
})

export interface AddSurveyQuestionsResult {
  survey_id: string
  survey_title: string
  questions_added: number
  total_questions: number
}

export const addSurveyQuestionsSchema = z.object({
  surveyId: z.string().uuid(),
  questions: z.array(questionSchema).min(1).max(50),
})

export type AddSurveyQuestionsInput = z.infer<typeof addSurveyQuestionsSchema>
export type QuestionInput = z.infer<typeof questionSchema>
