'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Loader2, MessageSquare, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AIChatProvider, useAIChat } from './ai-chat-provider'

function ChatBody() {
  const { messages, isLoading, sendMessage, clearChat, pendingAction, confirmAction } = useAIChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const suggestions = useMemo(
    () => [
      'Show survey progress for the latest survey',
      'What is the completion rate for survey "Employee Engagement"?',
      'How many responses are completed?',
      'Summarize the current survey status',
    ],
    []
  )

  const handleSend = async () => {
    await sendMessage(input)
    setInput('')
  }

  useEffect(() => {
    if (!scrollRef.current) return
    if (!isAtBottom) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length, isLoading, isAtBottom])

  return (
    <div className="flex h-full flex-col min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-4"
        onScroll={() => {
          if (!scrollRef.current) return
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
          const atBottom = scrollHeight - scrollTop - clientHeight < 80
          setIsAtBottom(atBottom)
        }}
      >
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Ask about survey progress, completion rate, or status. Try one of the suggestions below.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground ml-auto max-w-[85%]'
                  : 'bg-muted text-foreground max-w-[85%] border border-muted-foreground/10'
              }`}
            >
              {m.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-semibold mb-2">{children}</h2>,
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0">{children}</ol>,
                    code: ({ children }) => (
                      <code className="rounded bg-background/80 px-1 py-0.5 text-xs">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="rounded bg-background/80 p-2 text-xs overflow-x-auto">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => <th className="border-b px-2 py-1 text-left">{children}</th>,
                    td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
                  }}
                >
                  {m.content || (isLoading ? '…' : '')}
                </ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          ))
        )}
      </div>

      <div className="border-t p-3 shrink-0 bg-background">
        <div className="flex flex-wrap gap-2 pb-2 max-h-24 overflow-auto">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="secondary"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => sendMessage(suggestion)}
              disabled={isLoading}
            >
              {suggestion}
            </Button>
          ))}
        </div>
        {pendingAction && (
          <div className="mb-3 rounded-lg border bg-muted/50 p-3 text-sm">
            <div className="font-medium">Confirmation required</div>
            <p className="text-muted-foreground mt-1">
              {pendingAction.message}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => confirmAction(true)} disabled={isLoading}>
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => confirmAction(false)} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none"
            placeholder="Ask the AI assistant..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              'Send'
            )}
          </Button>
        </div>
        {isLoading && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            AI is working...
          </div>
        )}
      </div>
    </div>
  )
}

export function AIChatSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <AIChatProvider>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50"
          size="icon"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[380px] sm:w-[460px] p-0 overflow-hidden">
        <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                AI Assistant
              </SheetTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border px-2 py-0.5">Claude</span>
              </div>
              <div className="flex items-center gap-2">
                <ClearButton />
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <ChatBody />
          </div>
        </SheetContent>
      </Sheet>
    </AIChatProvider>
  )
}

function ClearButton() {
  const { clearChat } = useAIChat()
  return (
    <Button variant="ghost" size="icon" onClick={clearChat} aria-label="Clear chat">
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
