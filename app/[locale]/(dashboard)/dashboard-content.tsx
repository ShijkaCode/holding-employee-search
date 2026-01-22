'use client'

import { useAuth, AuthState } from '@/contexts/auth-context'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Dashboard content wrapper that handles auth state rendering.
 *
 * Rendering rules based on auth state machine:
 * - UNINITIALIZED, CHECKING_SESSION, AUTHENTICATED_NO_PROFILE → Loading spinner
 * - UNAUTHENTICATED → Redirect spinner (middleware handles actual redirect)
 * - AUTHENTICATED_READY → Render children (profile may be null, that's OK)
 * - ERROR → Show error message
 */
export function DashboardContent({ children }: { children: React.ReactNode }) {
    const { authState, user, profile, error, isLoading, isReady, isUnauthenticated } = useAuth()
    const t = useTranslations('Auth.states')

    console.log('[DashboardContent] Render - state:', authState, 'user:', user?.id, 'profile:', profile?.role)

    const getLoadingMessage = (state: AuthState): string => {
        switch (state) {
            case 'UNINITIALIZED':
                return t('initializing')
            case 'CHECKING_SESSION':
                return t('checking')
            case 'AUTHENTICATED_NO_PROFILE':
                return t('loadingProfile')
            default:
                return t('loading')
        }
    }

    // Loading states: UNINITIALIZED, CHECKING_SESSION, AUTHENTICATED_NO_PROFILE
    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        {getLoadingMessage(authState)}
                    </p>
                </div>
            </div>
        )
    }

    // Unauthenticated: show redirect spinner (middleware handles actual redirect)
    if (isUnauthenticated) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t('redirecting')}</p>
                </div>
            </div>
        )
    }

    // Error state: show error message with details
    if (authState === 'ERROR') {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                    <p className="text-lg font-semibold text-destructive">{t('authError')}</p>
                    <p className="text-sm text-muted-foreground">
                        {error || t('unexpectedError')}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                        {t('retry')}
                    </button>
                </div>
            </div>
        )
    }

    // AUTHENTICATED_READY: render children
    // Note: profile may be null here, and that's OK per requirements.
    // The UI components should handle null profile gracefully.
    if (isReady) {
        return <>{children}</>
    }

    // Fallback for any unexpected state (should never happen)
    console.warn('[DashboardContent] Unexpected auth state:', authState)
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
        </div>
    )
}
