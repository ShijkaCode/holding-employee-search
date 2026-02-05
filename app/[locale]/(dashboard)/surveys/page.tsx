'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { ClipboardList, Calendar, CheckCircle, Clock } from 'lucide-react'
import { format, isPast } from 'date-fns'

interface AssignedSurvey {
  id: string
  survey: {
    id: string
    title: string
    description: string | null
    deadline: string | null
    status: string
  }
  response?: {
    status: string
    submitted_at: string | null
  }
}

export default function SurveysPage() {
  const { user } = useAuth()
  const [surveys, setSurveys] = useState<AssignedSurvey[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Surveys')
  const tCommon = useTranslations('Common')

  const supabase = createClient()

  useEffect(() => {
    // User is guaranteed by layout, but add safety check
    if (!user) return

    const fetchSurveys = async () => {
      try {
        // Parallel fetch: assignments and responses at the same time
        const [assignmentsResult, responsesResult] = await Promise.all([
          supabase
            .from('survey_assignments')
            .select(`
              id,
              survey:surveys(id, title, description, deadline, status)
            `)
            .eq('employee_id', user.id),
          supabase
            .from('survey_responses')
            .select('survey_id, status, submitted_at')
            .eq('employee_id', user.id)
        ])

        const assignments = assignmentsResult.data
        const responses = responsesResult.data

        if (assignments && assignments.length > 0) {
          const surveysWithResponses = assignments.map((a: any) => {
            const surveyData = Array.isArray(a.survey) ? a.survey[0] : a.survey
            return {
              id: a.id,
              survey: surveyData,
              response: responses?.find((r) => r.survey_id === surveyData?.id),
            }
          }).filter(s => s.survey)

          setSurveys(surveysWithResponses)
        } else {
          setSurveys([])
        }
      } catch (error) {
        console.error('Error fetching surveys:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSurveys()
  }, [user, supabase])

  const getStatusBadge = (survey: AssignedSurvey) => {
    if (survey.response?.status === 'completed') {
      return <Badge className="bg-green-500">{t('status.completed')}</Badge>
    }
    if (survey.response?.status === 'partial') {
      return <Badge variant="secondary">{t('status.inProgress')}</Badge>
    }
    if (survey.survey?.deadline && isPast(new Date(survey.survey.deadline))) {
      return <Badge variant="destructive">{t('status.overdue')}</Badge>
    }
    return <Badge variant="outline">{t('status.notStarted')}</Badge>
  }

  const getStatusIcon = (survey: AssignedSurvey) => {
    if (survey.response?.status === 'completed') {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    }
    return <Clock className="h-5 w-5 text-muted-foreground" />
  }

  const pendingSurveys = surveys.filter(
    (s) => s.response?.status !== 'completed' && s.survey?.status === 'active'
  )
  const completedSurveys = surveys.filter(
    (s) => s.response?.status === 'completed'
  )

  // Show loading state while data is loading
  if (loading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-6 sm:h-8 w-36 sm:w-48" />
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 sm:h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t('subtitle')}
        </p>
      </div>

      {pendingSurveys.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-lg font-semibold">{t('pending')}</h2>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {pendingSurveys.map((survey) => (
              <Card key={survey.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        {getStatusIcon(survey)}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base sm:text-lg line-clamp-2">
                          {survey.survey?.title}
                        </CardTitle>
                        {survey.survey?.description && (
                          <CardDescription className="mt-1 text-xs sm:text-sm line-clamp-2">
                            {survey.survey.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(survey)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0 space-y-3 sm:space-y-4">
                  {survey.survey?.deadline && (
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span>
                        {tCommon('due')} {format(new Date(survey.survey.deadline), 'MMM d, yyyy')}
                      </span>
                      {isPast(new Date(survey.survey.deadline)) && (
                        <Badge variant="destructive" className="text-xs">
                          {t('status.overdue')}
                        </Badge>
                      )}
                    </div>
                  )}

                  <Button asChild className="w-full h-10 sm:h-9 text-sm">
                    <Link href={`/surveys/${survey.survey?.id}`}>
                      {survey.response?.status === 'partial'
                        ? t('continueSurvey')
                        : t('startSurvey')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {completedSurveys.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-lg font-semibold">{t('completed')}</h2>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {completedSurveys.map((survey) => (
              <Card key={survey.id} className="opacity-75">
                <CardHeader className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <CardTitle className="text-base sm:text-lg line-clamp-2">
                          {survey.survey?.title}
                        </CardTitle>
                        {survey.response?.submitted_at && (
                          <CardDescription className="mt-1 text-xs sm:text-sm">
                            {tCommon('completedOn')}{' '}
                            {format(
                              new Date(survey.response.submitted_at),
                              'MMM d, yyyy'
                            )}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-green-500 shrink-0 text-xs">{t('status.completed')}</Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {surveys.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
          <ClipboardList className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
          <CardTitle className="mb-2 text-center text-base sm:text-lg">{t('noSurveys')}</CardTitle>
          <CardDescription className="text-center text-sm">
            {t('noSurveysDesc')}
          </CardDescription>
        </Card>
      )}
    </div>
  )
}
