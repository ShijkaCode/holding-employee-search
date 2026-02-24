'use client'

import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  MessageSquare,
  PanelRightClose,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAIChatPanel } from './ai-chat-panel-context'
import { AIChatProvider, useAIChat } from './ai-chat-provider'
import { ChatBody } from './chat-body'

// ─── Resize Handle ──────────────────────────────────────────

function ResizeHandle() {
  const { width, setWidth, minWidth, maxWidth, setIsResizing } = useAIChatPanel()
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = width
      setIsResizing(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [width, setIsResizing]
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startX.current - e.clientX
      const newWidth = Math.max(minWidth, Math.min(startWidth.current + delta, maxWidth))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [minWidth, maxWidth, setWidth, setIsResizing])

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group/resize absolute left-0 top-0 bottom-0 z-10 flex w-1.5 cursor-col-resize items-center justify-center
        hover:bg-primary/10 active:bg-primary/20 transition-colors"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat panel"
    >
      <div className="h-8 w-1 rounded-full bg-border group-hover/resize:bg-primary/40 group-active/resize:bg-primary/60 transition-colors" />
    </div>
  )
}

// ─── Panel Header ───────────────────────────────────────────

function PanelHeader() {
  const { close } = useAIChatPanel()
  const { clearChat } = useAIChat()
  const t = useTranslations('AIChat')

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold">{t('panelTitle')}</span>
        <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground font-mono">
          {t('shortcut')}
        </kbd>
      </div>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={clearChat} aria-label={t('clearChat')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('clearChat')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={close} aria-label={t('closePanel')}>
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('closePanel')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

// ─── Mobile Header ──────────────────────────────────────────

function MobileHeader() {
  const { close } = useAIChatPanel()
  const { clearChat } = useAIChat()
  const t = useTranslations('AIChat')

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold">{t('panelTitle')}</span>
      </div>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon-xs" onClick={clearChat} aria-label={t('clearChat')}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={close} aria-label={t('closePanel')}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── FAB (Floating Action Button) ───────────────────────────

function ChatFAB() {
  const { open, isOpen } = useAIChatPanel()
  const t = useTranslations('AIChat')

  if (isOpen) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={open}
          className="fixed bottom-5 right-5 h-12 w-12 rounded-full shadow-lg z-50 group"
          size="icon"
          aria-label={t('openPanel')}
        >
          <MessageSquare className="h-5 w-5 transition-transform group-hover:scale-110" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {t('panelTitle')}
        <kbd className="ml-1.5 inline-flex h-4 items-center rounded border bg-muted px-1 text-[10px] font-mono">
          {t('shortcut')}
        </kbd>
      </TooltipContent>
    </Tooltip>
  )
}

// ─── Desktop Docked Panel ───────────────────────────────────

function DockedPanel() {
  const { isOpen, width, isResizing } = useAIChatPanel()

  return (
    <div
      className={cn(
        'relative shrink-0 bg-background overflow-hidden h-svh sticky top-0',
        !isResizing && 'transition-[width] duration-200 ease-in-out',
        isOpen ? 'border-l' : 'w-0'
      )}
      style={{ width: isOpen ? width : 0 }}
    >
      <ResizeHandle />
      <div className="flex h-full w-full flex-col pl-1.5 min-w-0">
        <PanelHeader />
        <div className="flex-1 min-h-0">
          <ChatBody />
        </div>
      </div>
    </div>
  )
}

// ─── Mobile Sheet Panel ─────────────────────────────────────

function MobilePanel() {
  const { isOpen, close } = useAIChatPanel()

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && close()}>
      <SheetContent side="right" className="w-full max-w-[420px] p-0 overflow-hidden [&>button]:hidden">
        <div className="flex h-full flex-col">
          <MobileHeader />
          <div className="flex-1 min-h-0">
            <ChatBody />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Export ─────────────────────────────────────────────

export function AIChatPanel() {
  const isMobile = useIsMobile()

  return (
    <AIChatProvider>
      <ChatFAB />
      {isMobile ? <MobilePanel /> : <DockedPanel />}
    </AIChatProvider>
  )
}
