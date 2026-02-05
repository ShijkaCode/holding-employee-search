import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateSurveyExportJSON } from '@/lib/survey-json-export'
import { sendSurveyToAI, checkAIServerHealth } from '@/lib/ai-integration/sentiment-client'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params
    const body = await request.json().catch(() => ({}))
    const { companyId } = body as { companyId?: string }

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
    }

    // Only admin and specialist can send to AI
    if (!['admin', 'specialist'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only administrators and specialists can request AI analysis' },
        { status: 403 }
      )
    }

    // Check AI server availability
    const healthCheck = await checkAIServerHealth()
    if (!healthCheck.available) {
      return NextResponse.json(
        { error: `AI server unavailable: ${healthCheck.message}` },
        { status: 503 }
      )
    }

    // Verify survey exists
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id, title, status')
      .eq('id', surveyId)
      .single()

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
    }

    // Check if there's already a pending/processing analysis
    const { data: existingAnalysis } = await supabase
      .from('survey_sentiment_analyses')
      .select('id, status')
      .eq('survey_id', surveyId)
      .in('status', ['pending', 'processing'])
      .single()

    if (existingAnalysis) {
      return NextResponse.json(
        { error: 'An analysis is already in progress for this survey', analysisId: existingAnalysis.id },
        { status: 409 }
      )
    }

    // Create analysis record
    const analysisId = randomUUID()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const callbackUrl = `${baseUrl}/api/surveys/${surveyId}/sentiment-callback`

    const { error: insertError } = await supabase
      .from('survey_sentiment_analyses')
      .insert({
        id: analysisId,
        survey_id: surveyId,
        status: 'pending',
        request_sent_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Failed to create analysis record:', insertError)
      return NextResponse.json({ error: 'Failed to create analysis record' }, { status: 500 })
    }

    // Generate JSON payload
    const exportJSON = await generateSurveyExportJSON(
      supabase,
      surveyId,
      analysisId,
      callbackUrl,
      companyId
    )

    // Check if there are responses to analyze
    if (exportJSON.responses.length === 0) {
      // Update status to failed
      await supabase
        .from('survey_sentiment_analyses')
        .update({ status: 'failed', error_message: 'No completed responses to analyze' })
        .eq('id', analysisId)

      return NextResponse.json(
        { error: 'No completed responses found for this survey' },
        { status: 400 }
      )
    }

    // Send to AI server
    try {
      const aiResponse = await sendSurveyToAI(exportJSON)

      // Update status to processing
      await supabase
        .from('survey_sentiment_analyses')
        .update({ status: 'processing' })
        .eq('id', analysisId)

      return NextResponse.json({
        success: true,
        message: 'Survey sent for AI analysis',
        analysisId,
        responsesCount: exportJSON.responses.length,
        jobId: aiResponse.jobId,
      })
    } catch (aiError) {
      // Update status to failed
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown AI server error'
      await supabase
        .from('survey_sentiment_analyses')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', analysisId)

      return NextResponse.json({ error: errorMessage }, { status: 502 })
    }
  } catch (error) {
    console.error('Send to AI error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint to check analysis status
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

    // Fetch latest analysis for this survey
    const { data: analysis, error: analysisError } = await supabase
      .from('survey_sentiment_analyses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (analysisError) {
      if (analysisError.code === 'PGRST116') {
        return NextResponse.json({ analysis: null, message: 'No analysis found for this survey' })
      }
      throw analysisError
    }

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Get analysis status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
