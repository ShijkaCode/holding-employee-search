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

interface DepartmentStats {
  department: string
  total_assigned: number
  total_completed: number
  completion_rate: number
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [surveyStats, setSurveyStats] = useState<SurveyStats[]>([])
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Dashboard')

  const supabase = createClient()
  const isAdmin = profile?.role === 'admin'

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

      // Parallel fetch for survey and department stats
      const [surveyResult, deptResult] = await Promise.all([
        supabase
          .from('survey_stats')
          .select('*')
          .eq('company_id', selectedCompany),
        supabase
          .from('department_stats')
          .select('*')
          .eq('company_id', selectedCompany)
      ])

      setSurveyStats(surveyResult.data || [])
      const deptData = deptResult.data

      const aggregatedDeptStats = (deptData || []).reduce((acc: Record<string, DepartmentStats>, curr) => {
        const dept = curr.department || 'Unknown'
        if (!acc[dept]) {
          acc[dept] = {
            department: dept,
            total_assigned: 0,
            total_completed: 0,
            completion_rate: 0,
          }
        }
        acc[dept].total_assigned += curr.total_assigned || 0
        acc[dept].total_completed += curr.total_completed || 0
        return acc
      }, {})

      Object.values(aggregatedDeptStats).forEach((dept) => {
        dept.completion_rate = dept.total_assigned > 0
          ? Math.round((dept.total_completed / dept.total_assigned) * 100)
          : 0
      })

      setDepartmentStats(Object.values(aggregatedDeptStats))
      setLoading(false)
    }

    fetchStats()
  }, [selectedCompany, supabase])

  const totalResponses = surveyStats.reduce((acc, s) => acc + (s.total_completed || 0), 0)
  const totalAssigned = surveyStats.reduce((acc, s) => acc + (s.total_assigned || 0), 0)
  const overallParticipation = totalAssigned > 0 ? Math.round((totalResponses / totalAssigned) * 100) : 0
  const activeSurveys = surveyStats.filter((s) => s.status === 'active').length

  const chartData = departmentStats.map((d) => ({
    name: d.department,
    completed: d.total_completed || 0,
    pending: (d.total_assigned || 0) - (d.total_completed || 0),
    rate: d.completion_rate || 0,
  }))

  // Show loading while data is loading
  if (loading && !selectedCompany) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
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
        {isAdmin && companies.length > 0 && (
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-[200px]">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="text-2xl font-bold">{departmentStats.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('participating')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t('departmentParticipation')}</CardTitle>
            <CardDescription>
              {t('byDepartment')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
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
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                {t('noDeptData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t('recentSurveys')}</CardTitle>
            <CardDescription>
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
