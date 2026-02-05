'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

type Status = 'validating' | 'success' | 'error'

export default function MagicLinkPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('Auth')

  const [status, setStatus] = useState<Status>('validating')
  const [error, setError] = useState<string>('')
  const [surveyId, setSurveyId] = useState<string | null>(null)

  useEffect(() => {
    const redeemToken = async () => {
      const token = searchParams.get('token')
      const survey = searchParams.get('survey')

      if (!token) {
        setStatus('error')
        setError('No magic link token provided')
        return
      }

      setSurveyId(survey)

      try {
        // ✅ NEW APPROACH: Validate and create session on CLIENT side
        const supabase = createClient()

        // Call API to validate token and get employee info
        const response = await fetch('/api/auth/validate-magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, surveyId: survey }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          setStatus('error')
          setError(result.error || 'Invalid or expired magic link')
          return
        }

        // Create session with returned credentials
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.tempPassword,
        })

        if (signInError) {
          throw new Error(`Failed to sign in: ${signInError.message}`)
        }

        setStatus('success')

        // Redirect after 1 second
        setTimeout(() => {
          if (survey) {
            router.push(`/surveys/${survey}`)
          } else {
            router.push('/surveys')
          }
        }, 1000)

      } catch (err) {
        console.error('Magic link redemption error:', err)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Failed to validate magic link')
      }
    }

    redeemToken()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-sm sm:max-w-md mx-auto shadow-lg">
        <CardHeader className="text-center px-4 sm:px-6 pt-6 sm:pt-8 pb-4">
          {status === 'validating' && (
            <>
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="p-3 sm:p-4 rounded-full bg-primary/10">
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg sm:text-xl">{t('magicLink.validating')}</CardTitle>
              <CardDescription className="text-sm sm:text-base mt-2">{t('magicLink.validatingDesc')}</CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="p-3 sm:p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-500" />
                </div>
              </div>
              <CardTitle className="text-lg sm:text-xl text-green-600">{t('magicLink.success')}</CardTitle>
              <CardDescription className="text-sm sm:text-base mt-2">{t('magicLink.successDesc')}</CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className="p-3 sm:p-4 rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-red-500" />
                </div>
              </div>
              <CardTitle className="text-lg sm:text-xl text-red-600">{t('magicLink.error')}</CardTitle>
              <CardDescription className="text-sm sm:text-base mt-2 text-red-600/80">{error}</CardDescription>
            </>
          )}
        </CardHeader>

        {status === 'error' && (
          <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
            <Button
              className="w-full h-11 sm:h-10 text-base sm:text-sm"
              onClick={() => router.push('/')}
            >
              {t('magicLink.backToHome')}
            </Button>
          </CardContent>
        )}

        {status === 'success' && surveyId && (
          <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('magicLink.redirecting')}</span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
