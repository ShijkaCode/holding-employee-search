import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch survey details
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, description, company_id')
      .eq('id', surveyId)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Fetch company name
    let companyName = ''
    if (survey.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', survey.company_id)
        .single()
      companyName = company?.name || ''
    }

    // Fetch questions
    const { data: questions, error: questionsError } = await supabase
      .from('survey_questions')
      .select('question_code, question_text, type, section_name, section_order, question_order')
      .eq('survey_id', surveyId)
      .order('section_order')
      .order('question_order')

    if (questionsError) {
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    // Fetch all responses (completed only)
    const { data: responses, error: responsesError } = await supabase
      .from('survey_responses')
      .select('answers, status')
      .eq('survey_id', surveyId)
      .eq('status', 'completed')

    if (responsesError) {
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
    }

    // Fetch assignment count
    const { count: assignedCount } = await supabase
      .from('survey_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', surveyId)

    const totalAssigned = assignedCount || 0
    const totalCompleted = responses?.length || 0
    const completionRate = totalAssigned > 0
      ? Math.round((totalCompleted / totalAssigned) * 100)
      : 0

    return NextResponse.json({
      survey: {
        title: survey.title,
        description: survey.description,
        company_name: companyName,
      },
      questions: questions || [],
      responses: responses?.map(r => ({ answers: r.answers })) || [],
      stats: {
        total_assigned: totalAssigned,
        total_completed: totalCompleted,
        completion_rate: completionRate,
      },
    })
  } catch (error) {
    console.error('Report data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
