import { SupabaseClient } from '@supabase/supabase-js'
import { Database, SurveyExportJSON, SurveyExportQuestion, SurveyExportResponse, SurveyExportAnswer, Enums } from '@/types/database'

type QuestionType = Enums<'question_type'>

/**
 * Maps question type to standardized value_type for AI processing
 */
function getValueType(questionType: QuestionType): SurveyExportAnswer['value_type'] {
  switch (questionType) {
    case 'scale':
    case 'rating':
      return 'numeric'
    case 'text':
      return 'text'
    case 'single_choice':
      return 'selection'
    case 'multiple_choice':
      return 'multi_selection'
    case 'date':
      return 'date'
    case 'file':
      return 'text' // File URLs are treated as text
    default:
      return 'text'
  }
}

/**
 * Generates standardized JSON export for survey data
 * This format is consistent regardless of question types
 */
export async function generateSurveyExportJSON(
  supabase: SupabaseClient<Database>,
  surveyId: string,
  analysisId: string,
  callbackUrl: string,
  companyIdFilter?: string
): Promise<SurveyExportJSON> {
  // Fetch survey details
  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .select('id, title, description, created_at')
    .eq('id', surveyId)
    .single()

  if (surveyError || !survey) {
    throw new Error(`Survey not found: ${surveyError?.message}`)
  }

  // Fetch questions ordered by section and question order
  const { data: questions, error: questionsError } = await supabase
    .from('survey_questions')
    .select('question_code, question_text, type, section_name, options')
    .eq('survey_id', surveyId)
    .order('section_order')
    .order('question_order')

  if (questionsError) {
    throw new Error(`Failed to fetch questions: ${questionsError.message}`)
  }

  // Build question lookup map
  const questionMap = new Map<string, { type: QuestionType; options: string[] | null }>()
  const exportQuestions: SurveyExportQuestion[] = (questions || []).map(q => {
    const options = Array.isArray(q.options) ? (q.options as string[]) : null
    questionMap.set(q.question_code, { type: q.type, options })

    return {
      code: q.question_code,
      text: q.question_text,
      type: q.type,
      section: q.section_name,
      options,
    }
  })

  // Fetch completed responses
  let responsesQuery = supabase
    .from('survey_responses')
    .select('id, answers, submitted_at')
    .eq('survey_id', surveyId)
    .eq('status', 'completed')

  if (companyIdFilter) {
    responsesQuery = responsesQuery.eq('company_id', companyIdFilter)
  }

  const { data: responses, error: responsesError } = await responsesQuery

  if (responsesError) {
    throw new Error(`Failed to fetch responses: ${responsesError.message}`)
  }

  // Transform responses to standardized format
  const exportResponses: SurveyExportResponse[] = (responses || []).map(response => {
    const rawAnswers = (response.answers as Record<string, string | string[]>) || {}

    const answers: SurveyExportAnswer[] = Object.entries(rawAnswers).map(([code, value]) => {
      const questionInfo = questionMap.get(code)
      const questionType = questionInfo?.type || 'text'

      return {
        question_code: code,
        question_type: questionType,
        value: value,
        value_type: getValueType(questionType),
      }
    })

    return {
      id: response.id,
      submitted_at: response.submitted_at,
      answers,
    }
  })

  return {
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      created_at: survey.created_at,
    },
    questions: exportQuestions,
    responses: exportResponses,
    metadata: {
      total_responses: exportResponses.length,
      export_date: new Date().toISOString(),
      callback_url: callbackUrl,
      analysis_id: analysisId,
    },
  }
}
