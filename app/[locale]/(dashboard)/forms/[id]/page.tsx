'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Bell,
  Edit,
  FileText,
  UserPlus,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Pause,
  XCircle,
  Download,
  FileDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'

interface Survey {
  id: string
  title: string
  description: string | null
  status: string
  deadline: string | null
  created_at: string | null
}

interface Question {
  id: string
  question_code: string
  question_text: string
  type: string
  section_name: string | null
  is_required: boolean | null
}

interface Response {
  id: string
  employee_id: string
  status: string
  submitted_at: string | null
  profile: {
    full_name: string
    email: string | null
    department: string | null
  }
}

interface IncompleteEmployee {
  employee_id: string
  full_name: string
  email: string | null
  department: string | null
  response_status: string
}

interface Employee {
  id: string
  full_name: string
  email: string | null
  department: string | null
}

interface Assignment {
  employee_id: string
}

export default function FormDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile } = useAuth()
  const surveyId = params.id as string
  const t = useTranslations('FormDetail')
  const tStatus = useTranslations('SurveyStatus')
  const tCommon = useTranslations('Common')

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [incompleteEmployees, setIncompleteEmployees] = useState<IncompleteEmployee[]>([])
  const [stats, setStats] = useState({ total: 0, completed: 0, partial: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Assignment state
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [exporting, setExporting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // Fetch survey
      const { data: surveyData } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single()

      if (surveyData) {
        setSurvey(surveyData)
      }

      // Fetch questions
      const { data: questionsData } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('survey_id', surveyId)
        .order('section_order')
        .order('question_order')

      setQuestions(questionsData || [])

      // Fetch responses with profiles
      const { data: responsesData } = await supabase
        .from('survey_responses')
        .select(`
          id,
          employee_id,
          status,
          submitted_at,
          profile:profiles(full_name, email, department)
        `)
        .eq('survey_id', surveyId)

      const formattedResponses = (responsesData || []).map((r) => ({
        ...r,
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
      }))

      setResponses(formattedResponses as Response[])

      // Calculate stats
      const completed = formattedResponses.filter((r) => r.status === 'completed').length
      const partial = formattedResponses.filter((r) => r.status === 'partial').length
      const pending = formattedResponses.filter((r) => r.status === 'pending').length

      setStats({
        total: formattedResponses.length,
        completed,
        partial,
        pending,
      })

      // Fetch incomplete employees
      const { data: incompleteData } = await supabase.rpc('get_incomplete_survey_employees', {
        p_survey_id: surveyId,
      })

      setIncompleteEmployees(incompleteData || [])

      // Fetch existing assignments
      const { data: assignmentsData } = await supabase
        .from('survey_assignments')
        .select('employee_id')
        .eq('survey_id', surveyId)

      setAssignments(assignmentsData || [])
      setSelectedEmployees((assignmentsData || []).map((a) => a.employee_id))

      // Fetch company employees for assignment
      if (surveyData?.company_id) {
        const { data: employeesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, department')
          .eq('company_id', surveyData.company_id)
          .eq('role', 'employee')
          .order('full_name')

        setEmployees(employeesData || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [surveyId, supabase])

  const mockNotify = async () => {
    setSendingReminder(true)

    // Simulate sending reminders
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const employeeIds = incompleteEmployees.map((e) => e.employee_id)
    console.log('Sending reminders to employees:', employeeIds)

    toast.success(t('remindersSent', { count: incompleteEmployees.length }), {
      description: t('remindersDesc'),
    })

    setSendingReminder(false)
  }

  const handleStatusChange = async (newStatus: 'draft' | 'active' | 'closed') => {
    if (!survey) return

    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('surveys')
        .update({ status: newStatus })
        .eq('id', surveyId)

      if (error) throw error

      setSurvey({ ...survey, status: newStatus })
      toast.success(t('statusChanged', { status: tStatus(newStatus) }))
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error(t('statusError'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleEmployeeToggle = (employeeId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees([...selectedEmployees, employeeId])
    } else {
      setSelectedEmployees(selectedEmployees.filter((id) => id !== employeeId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(employees.map((e) => e.id))
    } else {
      setSelectedEmployees([])
    }
  }

  const handleSaveAssignments = async () => {
    if (!user) return

    setAssigning(true)
    try {
      // Get current assignment IDs
      const currentAssignedIds = assignments.map((a) => a.employee_id)

      // Find new assignments (to add)
      const toAdd = selectedEmployees.filter((id) => !currentAssignedIds.includes(id))

      // Find removed assignments (to delete)
      const toRemove = currentAssignedIds.filter((id) => !selectedEmployees.includes(id))

      // Delete removed assignments
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('survey_assignments')
          .delete()
          .eq('survey_id', surveyId)
          .in('employee_id', toRemove)

        if (deleteError) throw deleteError
      }

      // Add new assignments
      if (toAdd.length > 0) {
        const newAssignments = toAdd.map((employeeId) => ({
          survey_id: surveyId,
          employee_id: employeeId,
          assigned_by: user.id,
        }))

        const { error: insertError } = await supabase
          .from('survey_assignments')
          .insert(newAssignments)

        if (insertError) throw insertError
      }

      // Update local state
      setAssignments(selectedEmployees.map((id) => ({ employee_id: id })))

      toast.success(t('assigned', { count: selectedEmployees.length }))
      setShowAssignDialog(false)
    } catch (error) {
      console.error('Error saving assignments:', error)
      toast.error(t('assignError'))
    } finally {
      setAssigning(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/export`)

      if (!response.ok) {
        let errorMessage = 'Export failed'
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch {
          errorMessage = `Server error: ${response.status}`
        }
        throw new Error(errorMessage)
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `survey_export_${surveyId}.csv`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) {
          filename = match[1]
        }
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(t('exportCompleted'), {
        description: t('exportDownloaded', { filename }),
      })
    } catch (error) {
      console.error('Error exporting:', error)
      toast.error(t('exportError'))
    } finally {
      setExporting(false)
    }
  }

  const handleViewReport = () => {
    // Open report page in new tab for printing/PDF
    window.open(`/forms/${surveyId}/report`, '_blank')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const groupedQuestions = questions.reduce((acc, q) => {
    const section = q.section_name || 'General'
    if (!acc[section]) acc[section] = []
    acc[section].push(q)
    return acc
  }, {} as Record<string, Question[]>)

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="p-6">
        <Card className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="mb-2">{t('surveyNotFound')}</CardTitle>
          <CardDescription className="mb-4">
            {t('surveyNotFoundDesc')}
          </CardDescription>
          <Button asChild>
            <Link href="/forms">{t('backToForms')}</Link>
          </Button>
        </Card>
      </div>
    )
  }

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{survey.title}</h1>
            <Select
              value={survey.status}
              onValueChange={(value) => handleStatusChange(value as 'draft' | 'active' | 'closed')}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">
                  <div className="flex items-center gap-2">
                    <Pause className="h-4 w-4" />
                    {tStatus('draft')}
                  </div>
                </SelectItem>
                <SelectItem value="active">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-green-500" />
                    {tStatus('active')}
                  </div>
                </SelectItem>
                <SelectItem value="closed">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    {tStatus('closed')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {survey.description && (
            <p className="text-muted-foreground mt-1">{survey.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                {t('assignCount', { count: assignments.length })}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('assignEmployees')}</DialogTitle>
                <DialogDescription>
                  {t('assignEmployeesDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center gap-2 pb-3 border-b">
                  <Checkbox
                    id="select-all"
                    checked={selectedEmployees.length === employees.length && employees.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    {t('selectAll', { count: employees.length })}
                  </label>
                </div>
                <ScrollArea className="h-[300px] mt-3">
                  <div className="space-y-3">
                    {employees.map((employee) => (
                      <div key={employee.id} className="flex items-center gap-3">
                        <Checkbox
                          id={employee.id}
                          checked={selectedEmployees.includes(employee.id)}
                          onCheckedChange={(checked) =>
                            handleEmployeeToggle(employee.id, checked as boolean)
                          }
                        />
                        <label htmlFor={employee.id} className="flex-1 cursor-pointer">
                          <p className="text-sm font-medium">{employee.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {employee.email} {employee.department && `• ${employee.department}`}
                          </p>
                        </label>
                      </div>
                    ))}
                    {employees.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {t('noEmployees')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button onClick={handleSaveAssignments} disabled={assigning}>
                  {assigning ? t('assignSaving') : t('assignButton', { count: selectedEmployees.length })}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || stats.completed === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? t('exporting') : t('csv')}
          </Button>
          <Button
            variant="outline"
            onClick={handleViewReport}
            disabled={stats.completed === 0}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {t('report')}
          </Button>
          <Button variant="outline" onClick={mockNotify} disabled={sendingReminder || incompleteEmployees.length === 0}>
            <Bell className="mr-2 h-4 w-4" />
            {sendingReminder ? t('sending') : t('remind')}
          </Button>
          <Button asChild>
            <Link href={`/forms/${surveyId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              {t('edit')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('completion')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <Progress value={completionRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {t('completed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              {t('inProgress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.partial}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              {t('notStarted')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incompleteEmployees.filter((e) => e.response_status === 'pending').length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions">
            {t('questionsTab', { count: questions.length })}
          </TabsTrigger>
          <TabsTrigger value="responses">
            {t('responsesTab', { count: responses.length })}
          </TabsTrigger>
          <TabsTrigger value="pending">
            {t('pendingTab', { count: incompleteEmployees.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>{t('surveyQuestions')}</CardTitle>
              <CardDescription>
                {t('surveyQuestionsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
                  <div key={section} className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">{section}</h3>
                    <div className="space-y-3">
                      {sectionQuestions.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <Badge variant="outline" className="shrink-0">
                            {q.question_code}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-medium">{q.question_text}</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Badge variant="secondary">{q.type}</Badge>
                              {q.is_required && (
                                <span className="text-red-500">{t('required')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {questions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4" />
                    <p>{t('noQuestionsAdded')}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses">
          <Card>
            <CardHeader>
              <CardTitle>{t('surveyResponses')}</CardTitle>
              <CardDescription>
                {t('surveyResponsesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('department')}</TableHead>
                    <TableHead>{tCommon('progress')}</TableHead>
                    <TableHead>{t('submitted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((response) => (
                    <TableRow key={response.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{response.profile?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {response.profile?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{response.profile?.department || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(response.status)}
                          <span className="capitalize">{response.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {response.submitted_at
                          ? format(new Date(response.submitted_at), 'MMM d, yyyy HH:mm')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {responses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        {t('noResponses')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('pendingEmployees')}</CardTitle>
                  <CardDescription>
                    {t('pendingEmployeesDesc')}
                  </CardDescription>
                </div>
                <Button onClick={mockNotify} disabled={sendingReminder || incompleteEmployees.length === 0}>
                  <Bell className="mr-2 h-4 w-4" />
                  {t('sendReminderAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('department')}</TableHead>
                    <TableHead>{tCommon('progress')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incompleteEmployees.map((employee) => (
                    <TableRow key={employee.employee_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {employee.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(employee.response_status)}
                          <span className="capitalize">{employee.response_status}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {incompleteEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        {t('allCompleted')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
