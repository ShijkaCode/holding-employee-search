'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const PANEL_STORAGE_KEY = 'ai-chat-panel'
const DEFAULT_WIDTH = 420
const MIN_WIDTH = 340
const MAX_WIDTH_RATIO = 0.5 // 50% of viewport

interface AIChatPanelContextValue {
  isOpen: boolean
  width: number
  minWidth: number
  maxWidth: number
  isResizing: boolean
  open: () => void
  close: () => void
  toggle: () => void
  setWidth: (width: number) => void
  setIsResizing: (v: boolean) => void
}

const AIChatPanelContext = createContext<AIChatPanelContextValue | null>(null)

function loadPersistedWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH
  try {
    const stored = localStorage.getItem(PANEL_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (typeof parsed.width === 'number' && parsed.width >= MIN_WIDTH) {
        return parsed.width
      }
    }
  } catch {}
  return DEFAULT_WIDTH
}

function persistWidth(width: number) {
  try {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ width }))
  } catch {}
}

export function AIChatPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [width, _setWidth] = useState(DEFAULT_WIDTH)
  const [maxWidth, setMaxWidth] = useState(800)
  const [isResizing, setIsResizing] = useState(false)

  // Load persisted width on mount
  useEffect(() => {
    _setWidth(loadPersistedWidth())
  }, [])

  // Update maxWidth on resize and clamp width if it exceeds the new max
  useEffect(() => {
    const update = () => {
      const newMax = Math.floor(window.innerWidth * MAX_WIDTH_RATIO)
      setMaxWidth(newMax)
      _setWidth((prev) => Math.max(MIN_WIDTH, Math.min(prev, newMax)))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  const setWidth = useCallback(
    (w: number) => {
      const clamped = Math.max(MIN_WIDTH, Math.min(w, maxWidth))
      _setWidth(clamped)
      persistWidth(clamped)
    },
    [maxWidth]
  )

  // Keyboard shortcut: Ctrl+. to toggle panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle])

  const value = useMemo<AIChatPanelContextValue>(
    () => ({ isOpen, width, minWidth: MIN_WIDTH, maxWidth, isResizing, open, close, toggle, setWidth, setIsResizing }),
    [isOpen, width, maxWidth, isResizing, open, close, toggle, setWidth]
  )

  return <AIChatPanelContext.Provider value={value}>{children}</AIChatPanelContext.Provider>
}

export function useAIChatPanel() {
  const ctx = useContext(AIChatPanelContext)
  if (!ctx) throw new Error('useAIChatPanel must be used within AIChatPanelProvider')
  return ctx
}
