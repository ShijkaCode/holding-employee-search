'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader2, Send, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { useAIChat } from './ai-chat-provider'

export function ChatBody() {
  const { messages, isLoading, sendMessage, pendingAction, confirmAction } = useAIChat()
  const t = useTranslations('AIChat')
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const suggestions = useMemo(() => {
    const raw = t.raw('suggestions')
    return Array.isArray(raw) ? raw : []
  }, [t])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput('')
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await sendMessage(trimmed)
  }

  // Auto-scroll
  useEffect(() => {
    if (!scrollRef.current || !isAtBottom) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length, messages[messages.length - 1]?.content, isLoading, isAtBottom])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
        onScroll={() => {
          if (!scrollRef.current) return
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
          setIsAtBottom(scrollHeight - scrollTop - clientHeight < 60)
        }}
      >
        {isEmpty ? (
          <EmptyState onSuggestionClick={(s) => sendMessage(s)} isLoading={isLoading} />
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                isLast={i === messages.length - 1}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action confirmation */}
      {pendingAction && (
        <div className="mx-3 mb-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">
            {t('confirmationTitle')}
          </div>
          <p className="mt-1 text-amber-700 dark:text-amber-300 text-xs">
            {pendingAction.message}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="xs" onClick={() => confirmAction(true)} disabled={isLoading}>
              {t('confirm')}
            </Button>
            <Button size="xs" variant="outline" onClick={() => confirmAction(false)} disabled={isLoading}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Quick suggestions (only when there are messages, shown inline) */}
      {!isEmpty && !isLoading && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-1 scrollbar-none">
          {suggestions.slice(0, 2).map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
              min-h-[40px] max-h-[120px]"
            placeholder={t('inputPlaceholder')}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 h-10 w-10 rounded-lg"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────

function EmptyState({
  onSuggestionClick,
  isLoading,
}: {
  onSuggestionClick: (s: string) => void
  isLoading: boolean
}) {
  const t = useTranslations('AIChat')
  const suggestions = useMemo(() => {
    const raw = t.raw('suggestions')
    return Array.isArray(raw) ? raw : []
  }, [t])
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-sm font-semibold">{t('panelTitle')}</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-[260px]">
        {t('emptyDescription')}
      </p>
      <div className="mt-5 flex flex-col gap-2 w-full max-w-[280px]">
        {suggestions.map((s) => (
          <button
            key={s}
            disabled={isLoading}
            onClick={() => onSuggestionClick(s)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-left text-xs text-muted-foreground
              hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  isLast,
  isLoading,
}: {
  role: 'user' | 'assistant'
  content: string
  isLast: boolean
  isLoading: boolean
}) {
  const isUser = role === 'user'
  const showTyping = !isUser && isLast && isLoading && !content

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'rounded-xl px-3 py-2 text-sm max-w-[88%]',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted border border-border/50 rounded-bl-sm'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : showTyping ? (
          <TypingDots />
        ) : content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-sm font-semibold mb-1.5">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-[13px] font-semibold mb-1.5">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xs font-semibold mb-1">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-1.5 last:mb-0 text-sm leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 last:mb-0 text-sm">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 last:mb-0 text-sm">{children}</ol>,
              li: ({ children }) => <li className="mb-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              code: ({ children }) => (
                <code className="rounded bg-background/80 px-1 py-0.5 text-xs font-mono">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="rounded-md bg-background/80 p-2 text-xs overflow-x-auto my-1.5">
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-1.5 rounded border">
                  <table className="w-full text-xs">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b bg-muted/50 px-2 py-1 text-left font-medium">{children}</th>
              ),
              td: ({ children }) => <td className="border-b px-2 py-1">{children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        ) : null}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
    </div>
  )
}
