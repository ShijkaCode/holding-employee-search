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
        let query = supabase
          .from('survey_stats')
          .select('*')
          .order('deadline', { ascending: false })

        if (profile?.role !== 'admin' && profile?.company_id) {
          query = query.eq('company_id', profile.company_id)
        }

        const { data: statsData } = await query

        if (statsData && statsData.length > 0) {
          const surveyIds = statsData.map((s) => s.survey_id).filter((id): id is string => id !== null)

          const { data: surveysData } = await supabase
            .from('surveys')
            .select('id, title, description, status, deadline, created_at')
            .in('id', surveyIds)

          const merged = statsData.map((stat) => {
            const survey = surveysData?.find((s) => s.id === stat.survey_id)
            return {
              id: stat.survey_id || '',
              title: survey?.title || stat.title || 'Untitled',
              description: survey?.description || null,
              status: stat.status || 'draft',
              deadline: stat.deadline,
              created_at: survey?.created_at || null,
              total_assigned: stat.total_assigned || 0,
              total_completed: stat.total_completed || 0,
              completion_rate: stat.completion_rate || 0,
            }
          })

          setSurveys(merged)
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/forms/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('newForm')}
          </Link>
        </Button>
      </div>

      {surveys.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="mb-2">{t('noForms')}</CardTitle>
          <CardDescription className="mb-4">
            {t('noFormsDesc')}
          </CardDescription>
          <Button asChild>
            <Link href="/forms/new">
              <Plus className="mr-2 h-4 w-4" />
              {t('createForm')}
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {surveys.map((survey) => (
            <Link key={survey.id} href={`/forms/${survey.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
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
      )}
    </div>
  )
}
