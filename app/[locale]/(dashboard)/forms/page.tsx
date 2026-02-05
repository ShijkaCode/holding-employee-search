'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Plus, FileText, Calendar, Users } from 'lucide-react'
import { format } from 'date-fns'

interface SurveyWithStats {
  id: string
  title: string
  description: string | null
  status: string
  deadline: string | null
  created_at: string | null
  scope: 'holding' | 'company'
  total_assigned: number
  total_completed: number
  completion_rate: number
}

export default function FormsPage() {
  const { profile } = useAuth()
  const [surveys, setSurveys] = useState<SurveyWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Forms')
  const tCommon = useTranslations('Common')
  const tSurveys = useTranslations('Surveys')

  const supabase = createClient()

  useEffect(() => {
    // Profile is guaranteed by layout, but add safety check
    if (!profile) return

    const fetchSurveys = async () => {
      try {
        const isHR = profile.role === 'hr'
        const userCompanyId = profile.company_id

        // For HR users, we need to filter surveys:
        // - Company surveys: only show their own company's surveys
        // - Holding surveys: show active ones (they'll see their company stats only)

        if (isHR && userCompanyId) {
          // Fetch company surveys (only HR's company)
          const { data: companySurveysData } = await (supabase as any)
            .from('survey_stats')
            .select('*')
            .eq('scope', 'company')
            .eq('company_id', userCompanyId)
            .order('created_at', { ascending: false })

          // Fetch holding surveys (active only for HR)
          // For holding surveys, get stats specific to HR's company from holding_survey_company_stats
          const { data: holdingSurveysData } = await supabase
            .from('surveys')
            .select('id, title, description, status, deadline, created_at, scope')
            .eq('scope', 'holding')
            .eq('status', 'active')
            .order('created_at', { ascending: false })

          // Get company-specific stats for holding surveys
          let holdingWithStats: SurveyWithStats[] = []
          if (holdingSurveysData && holdingSurveysData.length > 0) {
            const { data: companyStatsData } = await supabase
              .from('holding_survey_company_stats')
              .select('*')
              .eq('company_id', userCompanyId)
              .in('survey_id', holdingSurveysData.map(s => s.id))

            const statsMap = new Map(
              (companyStatsData || []).map(s => [s.survey_id, s])
            )

            holdingWithStats = holdingSurveysData.map(survey => {
              const stats = statsMap.get(survey.id)
              return {
                id: survey.id,
                title: survey.title,
                description: survey.description,
                status: survey.status,
                deadline: survey.deadline,
                created_at: survey.created_at,
                scope: 'holding' as const,
                total_assigned: Number(stats?.total_assigned) || 0,
                total_completed: Number(stats?.total_completed) || 0,
                completion_rate: Number(stats?.completion_rate) || 0,
              }
            })
          }

          const companySurveys = (companySurveysData || []).map((stats: any) => ({
            id: stats.survey_id,
            title: stats.title,
            description: stats.description,
            status: stats.status,
            deadline: stats.deadline,
            created_at: stats.created_at,
            scope: 'company' as const,
            total_assigned: Number(stats.total_assigned) || 0,
            total_completed: Number(stats.total_completed) || 0,
            completion_rate: Number(stats.completion_rate) || 0,
          }))

          setSurveys([...holdingWithStats, ...companySurveys])
        } else {
          // Admin/Specialist: show all surveys
          const { data: surveysData, error: surveysError } = await (supabase as any)
            .from('survey_stats')
            .select('*')
            .order('created_at', { ascending: false })

          if (surveysError) throw surveysError

          if (surveysData && surveysData.length > 0) {
            const surveysWithStats = surveysData.map((stats: {
              survey_id: string;
              title: string;
              description: string | null;
              status: string;
              deadline: string | null;
              created_at: string;
              scope: string;
              total_assigned: number;
              total_completed: number;
              completion_rate: number;
            }) => ({
              id: stats.survey_id,
              title: stats.title,
              description: stats.description,
              status: stats.status,
              deadline: stats.deadline,
              created_at: stats.created_at,
              scope: stats.scope as 'holding' | 'company',
              total_assigned: Number(stats.total_assigned) || 0,
              total_completed: Number(stats.total_completed) || 0,
              completion_rate: Number(stats.completion_rate) || 0,
            }))

            setSurveys(surveysWithStats)
          } else {
            setSurveys([])
          }
        }
      } catch (error) {
        console.error('Error fetching surveys:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSurveys()
  }, [profile, supabase])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'closed':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  // Show loading while data is loading
  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24 sm:w-32" />
          <Skeleton className="h-9 sm:h-10 w-24 sm:w-32" />
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 sm:h-48" />
          ))}
        </div>
      </div>
    )
  }

  // Separate surveys by scope
  const holdingSurveys = surveys.filter(s => s.scope === 'holding')
  const companySurveys = surveys.filter(s => s.scope === 'company')
  const canCreateSurveys = profile?.role && ['admin', 'specialist', 'hr'].includes(profile.role)

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        {canCreateSurveys && (
          <Button asChild size="sm" className="w-fit">
            <Link href="/forms/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('newForm')}
            </Link>
          </Button>
        )}
      </div>

      {surveys.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-8 sm:py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="mb-2">{t('noForms')}</CardTitle>
          <CardDescription className="mb-4">
            {t('noFormsDesc')}
          </CardDescription>
          {canCreateSurveys && (
            <Button asChild>
              <Link href="/forms/new">
                <Plus className="mr-2 h-4 w-4" />
                {t('createForm')}
              </Link>
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Holding Surveys Section */}
          {holdingSurveys.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-semibold">
                  {profile?.role === 'hr' ? 'Active Company-Wide Surveys' : 'Holding-Wide Surveys'}
                </h2>
                <Badge variant="outline">{holdingSurveys.length}</Badge>
                {profile?.role === 'hr' && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    View Only
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {holdingSurveys.map((survey) => (
                  <Link key={survey.id} href={`/forms/${survey.id}`}>
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg line-clamp-1">
                                {survey.title}
                              </CardTitle>
                              {profile?.role === 'hr' && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                  View Only
                                </Badge>
                              )}
                            </div>
                            {survey.description && (
                              <CardDescription className="line-clamp-2">
                                {survey.description}
                              </CardDescription>
                            )}
                          </div>
                          <Badge variant={getStatusColor(survey.status)}>
                            {survey.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{tCommon('progress')}</span>
                            <span className="font-medium">
                              {survey.completion_rate}%
                            </span>
                          </div>
                          <Progress value={survey.completion_rate} className="h-2" />
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{survey.total_completed}/{survey.total_assigned}</span>
                          </div>
                          {survey.deadline && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(survey.deadline), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Company Surveys Section */}
          {companySurveys.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-semibold">Company Surveys</h2>
                <Badge variant="outline">{companySurveys.length}</Badge>
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {companySurveys.map((survey) => (
                  <Link key={survey.id} href={`/forms/${survey.id}`}>
                    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <CardTitle className="text-lg line-clamp-1">
                              {survey.title}
                            </CardTitle>
                            {survey.description && (
                              <CardDescription className="line-clamp-2">
                                {survey.description}
                              </CardDescription>
                            )}
                          </div>
                          <Badge variant={getStatusColor(survey.status)}>
                            {survey.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{tCommon('progress')}</span>
                            <span className="font-medium">
                              {survey.completion_rate}%
                            </span>
                          </div>
                          <Progress value={survey.completion_rate} className="h-2" />
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{survey.total_completed}/{survey.total_assigned}</span>
                          </div>
                          {survey.deadline && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(survey.deadline), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
