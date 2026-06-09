import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { parseXlsxToSurveyJSON } from '@/lib/xlsx-to-survey-json'
import { sendSurveyToAI, checkAIServerHealth } from '@/lib/ai-integration/sentiment-client'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'specialist'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only administrators and specialists can upload survey files' },
        { status: 403 }
      )
    }

    // Check AI server
    const healthCheck = await checkAIServerHealth()
    if (!healthCheck.available) {
      return NextResponse.json(
        { error: `AI server unavailable: ${healthCheck.message}` },
        { status: 503 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Only .xlsx and .xls files are supported' },
        { status: 400 }
      )
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate IDs
    const analysisId = randomUUID()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    // Use a placeholder survey ID for xlsx imports
    const xlsxSurveyId = `xlsx-${analysisId}`
    const callbackUrl = `${baseUrl}/api/surveys/${xlsxSurveyId}/sentiment-callback`

    // Parse xlsx to JSON
    let exportJSON
    try {
      exportJSON = parseXlsxToSurveyJSON(buffer, {
        title: title || file.name.replace(/\.(xlsx|xls)$/, ''),
        callbackUrl,
        analysisId,
      })
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : 'Failed to parse file'
      return NextResponse.json({ error: `Parse error: ${message}` }, { status: 400 })
    }

    if (exportJSON.responses.length === 0) {
      return NextResponse.json(
        { error: 'No responses found in the file' },
        { status: 400 }
      )
    }

    // Create analysis record using admin client (AI tables not in typed schema)
    const supabaseAdmin = getSupabaseAdmin()
    const { error: insertError } = await (supabaseAdmin as any)
      .from('survey_sentiment_analyses')
      .insert({
        id: analysisId,
        survey_id: xlsxSurveyId,
        status: 'pending',
        request_sent_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Failed to create analysis record:', insertError)
      return NextResponse.json(
        { error: 'Failed to create analysis record' },
        { status: 500 }
      )
    }

    // Send to AI server
    try {
      const aiResponse = await sendSurveyToAI(exportJSON)

      await (supabaseAdmin as any)
        .from('survey_sentiment_analyses')
        .update({ status: 'processing' })
        .eq('id', analysisId)

      return NextResponse.json({
        success: true,
        message: 'File uploaded and sent for AI analysis',
        analysisId,
        surveyId: xlsxSurveyId,
        questionsCount: exportJSON.questions.length,
        responsesCount: exportJSON.responses.length,
        jobId: aiResponse.jobId,
      })
    } catch (aiError) {
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown AI server error'
      await (supabaseAdmin as any)
        .from('survey_sentiment_analyses')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', analysisId)

      return NextResponse.json({ error: errorMessage }, { status: 502 })
    }
  } catch (error) {
    console.error('Upload xlsx error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
