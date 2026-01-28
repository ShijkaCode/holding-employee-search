'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ANONYMITY_THRESHOLD } from './types'

interface AnonymityGuardProps {
  responseCount: number
  threshold?: number
  variant?: 'icon' | 'badge' | 'inline'
  className?: string
}

export function AnonymityGuard({
  responseCount,
  threshold = ANONYMITY_THRESHOLD,
  variant = 'icon',
  className,
}: AnonymityGuardProps) {
  const t = useTranslations('HierarchyTable')
  const isAtRisk = responseCount < threshold

  if (!isAtRisk) return null

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1 text-amber-600 text-xs ${className}`}>
        <AlertTriangle className="h-3 w-3" />
        {t('anonymityWarning')}
      </span>
    )
  }

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs ${className}`}>
              <ShieldAlert className="h-3 w-3" />
              {t('anonymityRisk')}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{t('anonymityTooltipTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t('anonymityTooltipDesc', { threshold })}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Default: icon variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className}>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{t('anonymityTooltipTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {t('anonymityTooltipDesc', { threshold })}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Utility component to wrap content that should be hidden when anonymity is at risk
interface AnonymityProtectedProps {
  responseCount: number
  threshold?: number
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AnonymityProtected({
  responseCount,
  threshold = ANONYMITY_THRESHOLD,
  children,
  fallback,
}: AnonymityProtectedProps) {
  const t = useTranslations('HierarchyTable')
  const isAtRisk = responseCount < threshold

  if (isAtRisk) {
    return fallback ?? (
      <span className="text-muted-foreground text-sm italic">
        {t('dataHidden')}
      </span>
    )
  }

  return <>{children}</>
}
