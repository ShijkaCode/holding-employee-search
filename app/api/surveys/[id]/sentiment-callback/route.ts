import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { SentimentAnalysisResult, Json } from '@/types/database'

const CALLBACK_SECRET = process.env.SENTIMENT_CALLBACK_SECRET

/**
 * Webhook endpoint for AI server to send analysis results
 * This endpoint is called by the external AI server, not by authenticated users
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params

    // Verify callback secret if configured
    if (CALLBACK_SECRET) {
      const authHeader = request.headers.get('Authorization')
      const providedSecret = authHeader?.replace('Bearer ', '')

      if (providedSecret !== CALLBACK_SECRET) {
        console.warn(`Invalid callback secret for survey ${surveyId}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json() as SentimentAnalysisResult

    // Validate required fields
    if (!body.analysis_id || !body.survey_id) {
      return NextResponse.json(
        { error: 'Missing required fields: analysis_id, survey_id' },
        { status: 400 }
      )
    }

    // Verify survey_id matches URL
    if (body.survey_id !== surveyId) {
      return NextResponse.json(
        { error: 'Survey ID mismatch' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Find the analysis record
    const { data: analysis, error: findError } = await supabaseAdmin
      .from('survey_sentiment_analyses')
      .select('id, status')
      .eq('id', body.analysis_id)
      .eq('survey_id', surveyId)
      .single()

    if (findError || !analysis) {
      console.error('Analysis record not found:', body.analysis_id)
      return NextResponse.json(
        { error: 'Analysis record not found' },
        { status: 404 }
      )
    }

    // Check if already completed
    if (analysis.status === 'completed') {
      return NextResponse.json(
        { message: 'Analysis already completed', analysisId: analysis.id },
        { status: 200 }
      )
    }

    // Update with results
    const { error: updateError } = await supabaseAdmin
      .from('survey_sentiment_analyses')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        results: body as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.analysis_id)

    if (updateError) {
      console.error('Failed to update analysis:', updateError)
      return NextResponse.json(
        { error: 'Failed to save analysis results' },
        { status: 500 }
      )
    }

    console.log(`Sentiment analysis completed for survey ${surveyId}, analysis ${body.analysis_id}`)

    return NextResponse.json({
      success: true,
      message: 'Analysis results received and saved',
      analysisId: body.analysis_id,
    })
  } catch (error) {
    console.error('Sentiment callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Endpoint to report analysis failure from AI server
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params

    // Verify callback secret
    if (CALLBACK_SECRET) {
      const authHeader = request.headers.get('Authorization')
      const providedSecret = authHeader?.replace('Bearer ', '')

      if (providedSecret !== CALLBACK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json() as { analysis_id: string; error: string }

    if (!body.analysis_id) {
      return NextResponse.json({ error: 'Missing analysis_id' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Update status to failed
    const { error: updateError } = await supabaseAdmin
      .from('survey_sentiment_analyses')
      .update({
        status: 'failed',
        error_message: body.error || 'AI processing failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.analysis_id)
      .eq('survey_id', surveyId)

    if (updateError) {
      console.error('Failed to update analysis status:', updateError)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Failure status recorded',
    })
  } catch (error) {
    console.error('Sentiment callback PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
