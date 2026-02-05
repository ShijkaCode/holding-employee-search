import { SurveyExportJSON } from '@/types/database'

const AI_SERVER_URL = process.env.SENTIMENT_AI_SERVER_URL
const AI_SERVER_API_KEY = process.env.SENTIMENT_AI_API_KEY

export interface SendToAIResponse {
  success: boolean
  message: string
  jobId?: string
}

export interface AIServerError {
  error: string
  code?: string
}

/**
 * Sends survey JSON to the AI sentiment analysis server
 * The AI server will process and call back to our webhook endpoint
 */
export async function sendSurveyToAI(payload: SurveyExportJSON): Promise<SendToAIResponse> {
  if (!AI_SERVER_URL) {
    throw new Error('SENTIMENT_AI_SERVER_URL environment variable is not configured')
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add API key if configured
  if (AI_SERVER_API_KEY) {
    headers['Authorization'] = `Bearer ${AI_SERVER_API_KEY}`
  }

  try {
    const response = await fetch(`${AI_SERVER_URL}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as AIServerError
      throw new Error(errorData.error || `AI server responded with status ${response.status}`)
    }

    const result = await response.json()

    return {
      success: true,
      message: 'Survey data sent to AI server successfully',
      jobId: result.jobId,
    }
  } catch (error) {
    if (error instanceof Error) {
      // Network or parsing errors
      if (error.message.includes('fetch')) {
        throw new Error(`Failed to connect to AI server: ${error.message}`)
      }
      throw error
    }
    throw new Error('Unknown error occurred while sending to AI server')
  }
}

/**
 * Check if AI server is configured and reachable
 */
export async function checkAIServerHealth(): Promise<{ available: boolean; message: string }> {
  if (!AI_SERVER_URL) {
    return { available: false, message: 'AI server URL not configured' }
  }

  try {
    const response = await fetch(`${AI_SERVER_URL}/health`, {
      method: 'GET',
      headers: AI_SERVER_API_KEY ? { 'Authorization': `Bearer ${AI_SERVER_API_KEY}` } : {},
    })

    if (response.ok) {
      return { available: true, message: 'AI server is available' }
    }

    return { available: false, message: `AI server returned status ${response.status}` }
  } catch {
    return { available: false, message: 'Cannot connect to AI server' }
  }
}
