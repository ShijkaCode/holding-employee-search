'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolResult?: unknown
}

interface AIChatContextValue {
  messages: ChatMessage[]
  isLoading: boolean
  sessionId: string | null
  pendingAction: PendingAction | null
  sendMessage: (message: string) => Promise<void>
  confirmAction: (confirmed: boolean) => Promise<void>
  clearChat: () => void
}

const AIChatContext = createContext<AIChatContextValue | null>(null)

interface PendingAction {
  id: string
  type: 'send_reminders' | 'activate_survey' | 'close_survey' | 'trigger_sentiment_analysis' | 'assign_survey_to_companies' | 'send_survey_invitations'
  surveyId: string
  message: string
  metadata?: Record<string, unknown>
}

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const sendMessage = async (message: string) => {
    const trimmed = message.trim()
    if (!trimmed) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ])

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId, locale }),
      })

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response stream')
      }

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'text') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + data.content } : m
              )
            )
          }
          if (data.type === 'tool_result') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, toolResult: data.data } : m
              )
            )
          }
          if (data.type === 'done') {
            if (data.sessionId) setSessionId(data.sessionId)
          }
          if (data.type === 'action_pending') {
            setPendingAction(data.action)
          }
          if (data.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: data.message } : m
              )
            )
          }
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sorry, something went wrong.'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: message } : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const confirmAction = async (confirmed: boolean) => {
    if (!pendingAction) return

    try {
      const response = await fetch('/api/ai/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: pendingAction.id, confirmed }),
      })

      const data = await response.json()

      let message: string
      if (!confirmed) {
        message = 'Action cancelled.'
      } else if (!response.ok) {
        message = data.error || 'Action failed. Please try again.'
      } else {
        message = data.message || 'Action completed.'
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
        },
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Failed to execute action. Please try again.',
        },
      ])
    } finally {
      setPendingAction(null)
    }
  }

  const clearChat = () => {
    setMessages([])
    setSessionId(null)
    setPendingAction(null)
  }

  const value = useMemo(
    () => ({ messages, isLoading, sessionId, pendingAction, sendMessage, confirmAction, clearChat }),
    [messages, isLoading, sessionId, pendingAction]
  )

  return <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
}

export function useAIChat() {
  const ctx = useContext(AIChatContext)
  if (!ctx) throw new Error('useAIChat must be used within AIChatProvider')
  return ctx
}
