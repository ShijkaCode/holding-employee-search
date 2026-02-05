'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Brain, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface AnalysisStatus {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  request_sent_at: string | null
  completed_at: string | null
  error_message: string | null
  results: Record<string, unknown> | null
}

interface AIAnalysisButtonProps {
  surveyId: string
  companyId?: string
  disabled?: boolean
}

export function AIAnalysisButton({ surveyId, companyId, disabled }: AIAnalysisButtonProps) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch current analysis status
  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/surveys/${surveyId}/send-to-ai`)
      const data = await res.json()
      setAnalysis(data.analysis || null)
    } catch (error) {
      console.error('Failed to fetch analysis status:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchStatus()
    }
  }, [open, surveyId])

  // Poll for status updates when processing
  useEffect(() => {
    if (analysis?.status === 'processing') {
      const interval = setInterval(fetchStatus, 5000)
      return () => clearInterval(interval)
    }
  }, [analysis?.status])

  const handleSendToAI = async () => {
    setSending(true)
    try {
      const res = await fetch(`/api/surveys/${surveyId}/send-to-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send to AI')
      }

      toast.success('Survey sent for AI analysis', {
        description: `Analyzing ${data.responsesCount} responses...`,
      })

      // Refresh status
      await fetchStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Failed to send to AI', { description: message })
    } finally {
      setSending(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  const canRequestNewAnalysis = !analysis || analysis.status === 'completed' || analysis.status === 'failed'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Brain className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">AI Analysis</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Sentiment Analysis
          </DialogTitle>
          <DialogDescription>
            Send survey responses to AI for sentiment analysis. Results will be available once processing completes.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : analysis ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Analysis</span>
                {getStatusBadge(analysis.status)}
              </div>

              {analysis.request_sent_at && (
                <div className="text-sm text-muted-foreground">
                  Requested: {new Date(analysis.request_sent_at).toLocaleString()}
                </div>
              )}

              {analysis.completed_at && (
                <div className="text-sm text-muted-foreground">
                  Completed: {new Date(analysis.completed_at).toLocaleString()}
                </div>
              )}

              {analysis.error_message && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded p-2">
                  {analysis.error_message}
                </div>
              )}

              {analysis.status === 'completed' && analysis.results && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  Analysis complete! Results are available in the database.
                </div>
              )}

              {analysis.status === 'processing' && (
                <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI is processing your survey responses...
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No analysis has been requested yet.</p>
              <p className="text-sm">Click below to send survey data for AI analysis.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            onClick={handleSendToAI}
            disabled={sending || !canRequestNewAnalysis}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                {analysis?.status === 'completed' || analysis?.status === 'failed'
                  ? 'Request New Analysis'
                  : 'Send to AI'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
