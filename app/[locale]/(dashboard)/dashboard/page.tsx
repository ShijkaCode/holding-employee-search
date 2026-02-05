'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { FileText, Users, TrendingUp, Clock } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface Company {
  id: string
  name: string
}

interface SurveyStats {
  survey_id: string | null
  title: string | null
  status: string | null
  deadline: string | null
  total_assigned: number | null
  total_completed: number | null
  completion_rate: number | null
}

interface OrgUnitStats {
  org_unit_id: string
  org_unit_name: string
  level_type: string
  total_assigned: number
  total_completed: number
  completion_rate: number
}

interface HoldingSurveyStats {
  survey_id: string
  survey_title: string
  survey_status: string
  total_companies: number
  total_assigned: number
  total_completed: number
  completion_rate: number
  companies: {
    company_id: string
    company_name: string
    assigned: number
    completed: number
    rate: number
  }[]
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [surveyStats, setSurveyStats] = useState<SurveyStats[]>([])
  const [orgUnitStats, setOrgUnitStats] = useState<OrgUnitStats[]>([])
  const [holdingSurveyStats, setHoldingSurveyStats] = useState<HoldingSurveyStats[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Dashboard')

  const supabase = createClient()
  const isAdmin = profile?.role === 'admin'
  const isSpecialist = profile?.role === 'specialist'

  useEffect(() => {
    // Profile is guaranteed by layout, but add safety check
    if (!profile) return

    const fetchCompanies = async () => {
      if (isAdmin) {
        const { data } = await supabase.from('companies').select('id, name').order('name')
        setCompanies(data || [])
        if (data && data.length > 0) {
          setSelectedCompany(data[0].id)
        }
      } else if (profile?.company_id) {
        setSelectedCompany(profile.company_id)
        const { data } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', profile.company_id)
          .single()
        if (data) setCompanies([data])
      }
    }
    fetchCompanies()
  }, [isAdmin, profile, supabase])

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCompany) return
      setLoading(true)

      // Parallel fetch for survey and org unit stats
      const [surveyResult, orgUnitResult] = await Promise.all([
        (supabase as any)
          .from('survey_stats')
          .select('*')
          .eq('company_id', selectedCompany),
        (supabase as any)
          .from('org_unit_stats')
          .select('*')
          .eq('company_id', selectedCompany)
      ])

      setSurveyStats(surveyResult.data || [])
      const orgUnitData = orgUnitResult.data

      // Aggregate org unit stats across all surveys
      const aggregatedOrgUnitStats: Record<string, OrgUnitStats> = (orgUnitData || []).reduce(
        (acc: Record<string, OrgUnitStats>, curr: { org_unit_id: string; org_unit_name: string; level_type: string; total_assigned: number; total_completed: number }) => {
          const unitId = curr.org_unit_id
          if (!acc[unitId]) {
            acc[unitId] = {
              org_unit_id: unitId,
              org_unit_name: curr.org_unit_name || 'Unknown',
              level_type: curr.level_type || '',
              total_assigned: 0,
              total_completed: 0,
              completion_rate: 0,
            }
          }
          acc[unitId].total_assigned += curr.total_assigned || 0
          acc[unitId].total_completed += curr.total_completed || 0
          return acc
        },
        {} as Record<string, OrgUnitStats>
      );

      (Object.values(aggregatedOrgUnitStats) as OrgUnitStats[]).forEach((unit) => {
        unit.completion_rate = unit.total_assigned > 0
          ? Math.round((unit.total_completed / unit.total_assigned) * 100)
          : 0
      })

      setOrgUnitStats(Object.values(aggregatedOrgUnitStats))
      setLoading(false)
    }

    fetchStats()
  }, [selectedCompany, supabase])

  // Fetch holding survey stats for Specialist
  useEffect(() => {
    const fetchHoldingStats = async () => {
      if (!isSpecialist) return
      setLoading(true)

      try {
        // Fetch all holding surveys
        const { data: surveys } = await supabase
          .from('surveys')
          .select('id, title, status')
          .eq('scope', 'holding')
          .order('created_at', { ascending: false })

        if (!surveys || surveys.length === 0) {
          setHoldingSurveyStats([])
          setLoading(false)
          return
        }

        // For each survey, get stats per company
        const statsPromises = surveys.map(async (survey) => {
          // Get all assignments for this survey grouped by company
          const { data: assignments } = await supabase
            .from('survey_assignments')
            .select(`
              employee_id,
              profile:profiles!survey_assignments_employee_id_fkey(company_id, companies(name))
            `)
            .eq('survey_id', survey.id)

          // Get all responses for this survey
          const { data: responses } = await supabase
            .from('survey_responses')
            .select('employee_id, status')
            .eq('survey_id', survey.id)
            .eq('status', 'completed')

          const responseSet = new Set(responses?.map(r => r.employee_id) || [])

          // Group by company
          const companyMap = new Map<string, { name: string; assigned: number; completed: number }>()

          assignments?.forEach((assignment) => {
            const profile = Array.isArray(assignment.profile) ? assignment.profile[0] : assignment.profile
            if (!profile?.company_id) return

            const companyId = profile.company_id
            const companyName = Array.isArray(profile.companies) ? profile.companies[0]?.name : profile.companies?.name

            if (!companyMap.has(companyId)) {
              companyMap.set(companyId, {
                name: companyName || 'Unknown',
                assigned: 0,
                completed: 0,
              })
            }

            const stats = companyMap.get(companyId)!
            stats.assigned++
            if (responseSet.has(assignment.employee_id)) {
              stats.completed++
            }
          })

          // Calculate totals
          let totalAssigned = 0
          let totalCompleted = 0
          const companies = Array.from(companyMap.entries()).map(([companyId, stats]) => {
            totalAssigned += stats.assigned
            totalCompleted += stats.completed
            return {
              company_id: companyId,
              company_name: stats.name,
              assigned: stats.assigned,
              completed: stats.completed,
              rate: stats.assigned > 0 ? Math.round((stats.completed / stats.assigned) * 100) : 0,
            }
          })

          return {
            survey_id: survey.id,
            survey_title: survey.title,
            survey_status: survey.status,
            total_companies: companyMap.size,
            total_assigned: totalAssigned,
            total_completed: totalCompleted,
            completion_rate: totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
            companies: companies.sort((a, b) => a.company_name.localeCompare(b.company_name)),
          }
        })

        const stats = await Promise.all(statsPromises)
        setHoldingSurveyStats(stats)
      } catch (error) {
        console.error('Error fetching holding stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHoldingStats()
  }, [isSpecialist, supabase])

  const totalResponses = surveyStats.reduce((acc, s) => acc + (s.total_completed || 0), 0)
  const totalAssigned = surveyStats.reduce((acc, s) => acc + (s.total_assigned || 0), 0)
  const overallParticipation = totalAssigned > 0 ? Math.round((totalResponses / totalAssigned) * 100) : 0
  const activeSurveys = surveyStats.filter((s) => s.status === 'active').length

  const chartData = orgUnitStats.map((d) => ({
    name: d.org_unit_name,
    completed: d.total_completed || 0,
    pending: (d.total_assigned || 0) - (d.total_completed || 0),
    rate: d.completion_rate || 0,
  }))

  // Show loading while data is loading
  if (loading && !selectedCompany && !isSpecialist) {
    return (
      <div className="page-container">
        <Skeleton className="h-10 w-36 sm:w-48" />
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 sm:h-32" />
          ))}
        </div>
      </div>
    )
  }

  // Specialist Dashboard View
  if (isSpecialist) {
    if (loading) {
      return (
        <div className="page-container">
          <Skeleton className="h-10 w-36 sm:w-48" />
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 sm:h-32" />
            ))}
          </div>
        </div>
      )
    }

    const totalHoldingAssigned = holdingSurveyStats.reduce((acc, s) => acc + s.total_assigned, 0)
    const totalHoldingCompleted = holdingSurveyStats.reduce((acc, s) => acc + s.total_completed, 0)
    const overallHoldingRate = totalHoldingAssigned > 0
      ? Math.round((totalHoldingCompleted / totalHoldingAssigned) * 100)
      : 0
    const activeHoldingSurveys = holdingSurveyStats.filter(s => s.survey_status === 'active').length

    // Get all unique companies from all surveys
    const allCompanies = new Set<string>()
    holdingSurveyStats.forEach(survey => {
      survey.companies.forEach(company => {
        allCompanies.add(company.company_name)
      })
    })

    return (
      <div className="page-container">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')} - Specialist View</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Multi-company analytics for holding-wide surveys
          </p>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHoldingCompleted}</div>
              <p className="text-xs text-muted-foreground">
                of {totalHoldingAssigned} assigned
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Completion</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallHoldingRate}%</div>
              <p className="text-xs text-muted-foreground">
                Across all companies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Surveys</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeHoldingSurveys}</div>
              <p className="text-xs text-muted-foreground">
                of {holdingSurveyStats.length} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allCompanies.size}</div>
              <p className="text-xs text-muted-foreground">
                Participating companies
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Holding Surveys List with Company Breakdown */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Holding Surveys</h2>
          {holdingSurveyStats.length > 0 ? (
            holdingSurveyStats.map((survey) => (
              <Card key={survey.survey_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{survey.survey_title}</CardTitle>
                      <CardDescription>
                        {survey.total_completed} of {survey.total_assigned} responses ({survey.completion_rate}%)
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={survey.survey_status === 'active' ? 'default' : 'secondary'}>
                        {survey.survey_status}
                      </Badge>
                      <Badge variant="outline">
                        {survey.total_companies} companies
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Company Breakdown:
                    </p>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {survey.companies.map((company) => (
                        <div
                          key={company.company_id}
                          className="flex items-center justify-between rounded-md border p-2"
                        >
                          <span className="text-sm font-medium">{company.company_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {company.completed}/{company.assigned}
                            </span>
                            <Badge
                              variant={company.rate >= 80 ? 'default' : company.rate >= 50 ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {company.rate}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No holding surveys found. Create a holding-wide survey to get started.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  // Admin/HR Dashboard View
  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
        {isAdmin && companies.length > 0 && (
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('selectCompany')} />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalResponses')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
            <p className="text-xs text-muted-foreground">
              {t('assignedCount', { total: totalAssigned })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('participationRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallParticipation}%</div>
            <p className="text-xs text-muted-foreground">
              {t('completionRate')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('activeSurveys')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSurveys}</div>
            <p className="text-xs text-muted-foreground">
              {t('currentlyRunning')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('departments')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgUnitStats.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('participating')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">{t('departmentParticipation')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('byDepartment')}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="pending" name="Pending" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[200px] sm:h-[250px] items-center justify-center text-muted-foreground text-sm">
                {t('noDeptData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">{t('recentSurveys')}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t('statusOfCurrent')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {surveyStats.length > 0 ? (
                surveyStats.slice(0, 5).map((survey) => (
                  <div
                    key={survey.survey_id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{survey.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('responsesCount', { completed: survey.total_completed || 0, total: survey.total_assigned || 0 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          survey.status === 'active'
                            ? 'default'
                            : survey.status === 'closed'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {survey.status}
                      </Badge>
                      <span className="text-sm font-medium">
                        {survey.completion_rate || 0}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  {t('noSurveysFound')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
