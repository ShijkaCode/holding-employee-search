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
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {pendingSurveys.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('pending')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pendingSurveys.map((survey) => (
              <Card key={survey.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(survey)}
                      <div>
                        <CardTitle className="text-lg">
                          {survey.survey?.title}
                        </CardTitle>
                        {survey.survey?.description && (
                          <CardDescription className="mt-1">
                            {survey.survey.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(survey)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {survey.survey?.deadline && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {tCommon('due')} {format(new Date(survey.survey.deadline), 'MMM d, yyyy')}
                      </span>
                      {isPast(new Date(survey.survey.deadline)) && (
                        <Badge variant="destructive" className="ml-2">
                          {t('status.overdue')}
                        </Badge>
                      )}
                    </div>
                  )}

                  <Button asChild className="w-full">
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
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t('completed')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {completedSurveys.map((survey) => (
              <Card key={survey.id} className="opacity-75">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <CardTitle className="text-lg">
                          {survey.survey?.title}
                        </CardTitle>
                        {survey.response?.submitted_at && (
                          <CardDescription className="mt-1">
                            {tCommon('completedOn')}
                            {format(
                              new Date(survey.response.submitted_at),
                              'MMM d, yyyy'
                            )}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-green-500">{t('status.completed')}</Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {surveys.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="mb-2">{t('noSurveys')}</CardTitle>
          <CardDescription>
            {t('noSurveysDesc')}
          </CardDescription>
        </Card>
      )}
    </div>
  )
}
