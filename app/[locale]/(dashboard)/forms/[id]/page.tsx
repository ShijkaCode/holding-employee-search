'use client'

import { useEffect, useState, useCallback } from 'react'
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
  Trash2,
  Mail,
  Send,
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronRight,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AIAnalysisButton } from '@/components/survey/ai-analysis-button'

interface Survey {
  id: string
  title: string
  description: string | null
  status: string
  deadline: string | null
  created_at: string | null
  company_id: string | null
  scope: string | null
}

interface CompanyStat {
  company_id: string
  company_name: string
  total_assigned: number
  total_completed: number
  total_partial: number
  completion_rate: number
}

interface Company {
  id: string
  name: string
  employee_count?: number
}

interface OrgUnit {
  id: string
  name: string
  company_id: string
  parent_id: string | null
  level_type: string
  employee_count?: number
}

interface Question {
  id: string
  question_code: string
  question_text: string
  type: string
  section_name: string | null
  is_required: boolean | null
  section_order: number | null
  question_order: number | null
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
    org_unit_id: string | null
  }
  org_path?: string | null
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

interface Invitation {
  id: string
  employee_id: string
  sent_at: string
  status: 'sent' | 'delivered' | 'bounced' | 'failed' | 'clicked' | 'completed'
  clicked_at: string | null
  completed_at: string | null
  retry_count: number
  last_retry_at: string | null
  profile: {
    full_name: string
    email: string | null
    department: string | null
  }
}

export default function FormDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile } = useAuth()
  const surveyId = params.id as string
  const t = useTranslations('FormDetail')
  const tForms = useTranslations('Forms')
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

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Invitation state
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [sendingInvitations, setSendingInvitations] = useState(false)
  const [invitationStats, setInvitationStats] = useState({
    total: 0,
    sent: 0,
    clicked: 0,
    completed: 0,
    failed: 0,
  })

  // Holding survey state
  const [companyStats, setCompanyStats] = useState<CompanyStat[]>([])
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all')
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [assignedCompanyIds, setAssignedCompanyIds] = useState<string[]>([])

  // Company assignment dialog state (for holding surveys)
  const [showCompanyAssignDialog, setShowCompanyAssignDialog] = useState(false)
  const [selectedCompaniesForAssign, setSelectedCompaniesForAssign] = useState<string[]>([])
  const [companyOrgUnits, setCompanyOrgUnits] = useState<Record<string, OrgUnit[]>>({})
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set())
  const [assigningCompanies, setAssigningCompanies] = useState(false)

  const supabase = createClient()

  // Function to refresh invitations data without page reload
  const refreshInvitations = useCallback(async () => {
    const { data: invitationsData } = await supabase
      .from('survey_invitations')
      .select(`
        id,
        employee_id,
        sent_at,
        status,
        clicked_at,
        completed_at,
        retry_count,
        last_retry_at,
        profile:profiles!survey_invitations_employee_id_fkey(full_name, email, department)
      `)
      .eq('survey_id', surveyId)
      .order('sent_at', { ascending: false })

    const formattedInvitations = (invitationsData || []).map((inv) => ({
      ...inv,
      profile: Array.isArray(inv.profile) ? inv.profile[0] : inv.profile,
    }))

    setInvitations(formattedInvitations as Invitation[])

    // Calculate invitation stats
    const totalInvitations = formattedInvitations.length
    const sentCount = formattedInvitations.filter(i => i.status === 'sent' || i.status === 'delivered').length
    const clickedCount = formattedInvitations.filter(i => i.clicked_at !== null).length
    const completedCount = formattedInvitations.filter(i => i.status === 'completed').length
    const failedCount = formattedInvitations.filter(i => i.status === 'failed' || i.status === 'bounced').length

    setInvitationStats({
      total: totalInvitations,
      sent: sentCount,
      clicked: clickedCount,
      completed: completedCount,
      failed: failedCount,
    })
  }, [surveyId, supabase])

  const isHoldingSurvey = survey?.scope === 'holding'
  const canManageHoldingSurvey = profile?.role === 'admin' || profile?.role === 'specialist'
  const isHRViewingHoldingSurvey = profile?.role === 'hr' && isHoldingSurvey

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const isHR = profile?.role === 'hr'
      const userCompanyId = profile?.company_id

      // Fetch survey
      const { data: surveyData } = await supabase
        .from('surveys')
        .select('id, title, description, status, deadline, created_at, company_id, scope')
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

      // For HR viewing holding survey: filter all data by their company
      const isHROnHolding = isHR && surveyData?.scope === 'holding' && userCompanyId

      // Fetch responses with profiles - filter by company for HR on holding surveys
      let responsesQuery = supabase
        .from('survey_responses')
        .select(`
          id,
          employee_id,
          status,
          submitted_at,
          company_id,
          profile:profiles(full_name, email, department, org_unit_id)
        `)
        .eq('survey_id', surveyId)

      if (isHROnHolding) {
        responsesQuery = responsesQuery.eq('company_id', userCompanyId)
      }

      const { data: responsesData } = await responsesQuery

      // Fetch org_hierarchy to get department paths
      const { data: orgHierarchyData } = await supabase
        .from('org_hierarchy')
        .select('id, path_names')

      const orgPathMap = new Map<string, string>()
      ;(orgHierarchyData || []).forEach((oh: { id: string; path_names: string }) => {
        orgPathMap.set(oh.id, oh.path_names)
      })

      const formattedResponses = (responsesData || []).map((r) => {
        const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile
        const orgUnitId = profile?.org_unit_id
        return {
          ...r,
          profile,
          org_path: orgUnitId ? orgPathMap.get(orgUnitId) || null : null,
        }
      })

      setResponses(formattedResponses as Response[])

      // Fetch existing assignments - filter by company for HR on holding surveys
      let assignmentsQuery = supabase
        .from('survey_assignments')
        .select('employee_id, profiles!survey_assignments_employee_id_fkey(company_id)')
        .eq('survey_id', surveyId)

      const { data: assignmentsRaw } = await assignmentsQuery

      // Filter assignments for HR viewing holding survey
      let filteredAssignments = assignmentsRaw || []
      if (isHROnHolding) {
        filteredAssignments = (assignmentsRaw || []).filter((a: any) => {
          const assignedProfile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
          return assignedProfile?.company_id === userCompanyId
        })
      }

      const assignmentsData = filteredAssignments.map((a: any) => ({ employee_id: a.employee_id }))
      setAssignments(assignmentsData)
      setSelectedEmployees(assignmentsData.map((a) => a.employee_id))

      // Calculate stats based on assignments (total assigned), not just responses
      const totalAssigned = assignmentsData.length
      const completed = formattedResponses.filter((r) => r.status === 'completed').length
      const partial = formattedResponses.filter((r) => r.status === 'partial').length
      // Not started = assigned but no response record exists
      const notStarted = totalAssigned - formattedResponses.length

      setStats({
        total: totalAssigned,
        completed,
        partial,
        pending: notStarted,
      })

      // Fetch incomplete employees - filter by company for HR on holding surveys
      if (isHROnHolding) {
        // Use the RPC but filter results by company
        const { data: incompleteData } = await (supabase as any).rpc('get_incomplete_survey_employees', {
          p_survey_id: surveyId,
        })

        // Filter by company - need to get employee company info
        const { data: employeeCompanies } = await supabase
          .from('profiles')
          .select('id, company_id')
          .eq('company_id', userCompanyId)

        const companyEmployeeIds = new Set((employeeCompanies || []).map(e => e.id))
        const filteredIncomplete = (incompleteData || []).filter((e: IncompleteEmployee) =>
          companyEmployeeIds.has(e.employee_id)
        )
        setIncompleteEmployees(filteredIncomplete)
      } else {
        const { data: incompleteData } = await (supabase as any).rpc('get_incomplete_survey_employees', {
          p_survey_id: surveyId,
        })
        setIncompleteEmployees(incompleteData || [])
      }

      // Fetch company employees for assignment (for company surveys)
      if (surveyData?.company_id) {
        const { data: employeesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, department')
          .eq('company_id', surveyData.company_id)
          .eq('role', 'employee')
          .order('full_name')

        setEmployees(employeesData || [])
      }

      // For holding surveys, fetch company stats and all companies
      if (surveyData?.scope === 'holding') {
        // Fetch all companies (admin/specialist only)
        if (!isHR) {
          const { data: companiesData } = await supabase
            .from('companies')
            .select('id, name')
            .order('name')

          setAllCompanies(companiesData || [])
        }

        // Fetch assigned companies
        const { data: companyAssignments } = await supabase
          .from('survey_company_assignments')
          .select('company_id')
          .eq('survey_id', surveyId)

        const assignedIds = (companyAssignments || []).map(a => a.company_id)
        setAssignedCompanyIds(assignedIds)
        setSelectedCompaniesForAssign(assignedIds)

        // Fetch company stats from view - HR only sees their company
        let statsQuery = supabase
          .from('holding_survey_company_stats')
          .select('*')
          .eq('survey_id', surveyId)

        if (isHROnHolding) {
          statsQuery = statsQuery.eq('company_id', userCompanyId)
        }

        const { data: statsData } = await statsQuery

        setCompanyStats((statsData || []).map(s => ({
          company_id: s.company_id || '',
          company_name: s.company_name || '',
          total_assigned: s.total_assigned || 0,
          total_completed: s.total_completed || 0,
          total_partial: s.total_partial || 0,
          completion_rate: s.completion_rate || 0,
        })))
      }

      // Fetch invitations
      const { data: invitationsData } = await supabase
        .from('survey_invitations')
        .select(`
          id,
          employee_id,
          sent_at,
          status,
          clicked_at,
          completed_at,
          retry_count,
          last_retry_at,
          profile:profiles!survey_invitations_employee_id_fkey(full_name, email, department)
        `)
        .eq('survey_id', surveyId)
        .order('sent_at', { ascending: false })

      const formattedInvitations = (invitationsData || []).map((inv) => ({
        ...inv,
        profile: Array.isArray(inv.profile) ? inv.profile[0] : inv.profile,
      }))

      setInvitations(formattedInvitations as Invitation[])

      // Calculate invitation stats
      const totalInvitations = formattedInvitations.length
      const sentCount = formattedInvitations.filter(i => i.status === 'sent' || i.status === 'delivered').length
      const clickedCount = formattedInvitations.filter(i => i.clicked_at !== null).length
      const completedCount = formattedInvitations.filter(i => i.status === 'completed').length
      const failedCount = formattedInvitations.filter(i => i.status === 'failed' || i.status === 'bounced').length

      setInvitationStats({
        total: totalInvitations,
        sent: sentCount,
        clicked: clickedCount,
        completed: completedCount,
        failed: failedCount,
      })

      setLoading(false)
    }

    fetchData()
  }, [surveyId, supabase, profile])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('surveys').delete().eq('id', surveyId)
      if (error) throw error
      
      toast.success(tForms('messages.deleteSuccess'))
      router.push('/forms')
    } catch (error) {
      console.error('Error deleting survey:', error)
      toast.error(tForms('messages.deleteError'))
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

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

  // Save company assignments for holding surveys
  const handleSaveCompanyAssignments = async () => {
    if (!user) return

    setAssigningCompanies(true)
    try {
      const currentAssignedIds = assignedCompanyIds
      const toAdd = selectedCompaniesForAssign.filter(id => !currentAssignedIds.includes(id))
      const toRemove = currentAssignedIds.filter(id => !selectedCompaniesForAssign.includes(id))

      // Remove unselected companies
      if (toRemove.length > 0) {
        // First remove employee assignments for those companies
        const { data: employeesToRemove } = await supabase
          .from('profiles')
          .select('id')
          .in('company_id', toRemove)
          .eq('role', 'employee')

        if (employeesToRemove && employeesToRemove.length > 0) {
          await supabase
            .from('survey_assignments')
            .delete()
            .eq('survey_id', surveyId)
            .in('employee_id', employeesToRemove.map(e => e.id))
        }

        // Then remove company assignments
        await supabase
          .from('survey_company_assignments')
          .delete()
          .eq('survey_id', surveyId)
          .in('company_id', toRemove)
      }

      // Add new companies
      if (toAdd.length > 0) {
        // Add company assignments
        const newCompanyAssignments = toAdd.map(companyId => ({
          survey_id: surveyId,
          company_id: companyId,
          assigned_by: user.id,
        }))

        await supabase
          .from('survey_company_assignments')
          .insert(newCompanyAssignments)

        // Add employee assignments for all employees in those companies
        const { data: employeesToAdd } = await supabase
          .from('profiles')
          .select('id')
          .in('company_id', toAdd)
          .eq('role', 'employee')

        if (employeesToAdd && employeesToAdd.length > 0) {
          const newEmployeeAssignments = employeesToAdd.map(emp => ({
            survey_id: surveyId,
            employee_id: emp.id,
            assigned_by: user.id,
          }))

          await supabase
            .from('survey_assignments')
            .upsert(newEmployeeAssignments, { onConflict: 'survey_id,employee_id', ignoreDuplicates: true })
        }
      }

      setAssignedCompanyIds(selectedCompaniesForAssign)
      toast.success(t('companiesAssigned', { count: selectedCompaniesForAssign.length }))
      setShowCompanyAssignDialog(false)

      // Refresh page data
      window.location.reload()
    } catch (error) {
      console.error('Error saving company assignments:', error)
      toast.error(t('companyAssignError'))
    } finally {
      setAssigningCompanies(false)
    }
  }

  const toggleCompanyExpanded = (companyId: string) => {
    setExpandedCompanies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(companyId)) {
        newSet.delete(companyId)
      } else {
        newSet.add(companyId)
      }
      return newSet
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const companyFilter = selectedCompanyFilter !== 'all' ? `?companyId=${selectedCompanyFilter}` : ''
      const response = await fetch(`/api/surveys/${surveyId}/export${companyFilter}`)

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

  const handleSendInvitations = async (employeeIds?: string[]) => {
    setSendingInvitations(true)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/send-invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds,
          method: 'email',
          companyId: selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send invitations')
      }

      const { sent, failed, total } = result.results

      if (failed === 0) {
        toast.success(t('invitationsSent', { count: sent }), {
          description: t('invitationsDesc'),
        })
      } else {
        toast.warning(t('invitationsPartial', { sent, failed, total }))
      }

      // Refresh invitations data without page reload
      await refreshInvitations()
    } catch (error) {
      console.error('Error sending invitations:', error)
      toast.error(t('invitationsError'))
    } finally {
      setSendingInvitations(false)
    }
  }

  const handleResendInvitation = async (employeeId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}/send-invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: [employeeId],
          method: 'email',
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to resend invitation')
      }

      toast.success(t('invitationResent'))

      // Refresh invitations data without page reload
      await refreshInvitations()
    } catch (error) {
      console.error('Error resending invitation:', error)
      toast.error(t('invitationResendError'))
    }
  }

  const handleResendFailed = async () => {
    const failedIds = invitations
      .filter(inv => inv.status === 'failed' || inv.status === 'bounced')
      .map(inv => inv.employee_id)

    if (failedIds.length === 0) {
      toast.info(t('noFailedInvitations'))
      return
    }

    await handleSendInvitations(failedIds)
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

  const getInvitationStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'clicked':
        return <Mail className="h-4 w-4 text-blue-500" />
      case 'delivered':
      case 'sent':
        return <Send className="h-4 w-4 text-blue-400" />
      case 'bounced':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getInvitationStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      sent: t('invitationSent'),
      delivered: t('invitationDelivered'),
      clicked: t('invitationClicked'),
      completed: t('invitationCompleted'),
      bounced: t('invitationBounced'),
      failed: t('invitationFailed'),
    }
    return statusMap[status] || status
  }

  const groupedQuestions = questions.reduce((acc, q) => {
    const section = q.section_name || 'General'
    if (!acc[section]) acc[section] = []
    acc[section].push(q)
    return acc
  }, {} as Record<string, Question[]>)

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 sm:h-24" />
          ))}
        </div>
        <Skeleton className="h-64 sm:h-96" />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="page-container">
        <Card className="flex flex-col items-center justify-center py-8 sm:py-12">
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
    <div className="page-container">
      {/* Header Row 1: Back button + Title + Status */}
      <div className="flex items-start gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{survey.title}</h1>
            {isHRViewingHoldingSurvey ? (
              /* HR viewing holding survey: show status as badge only (read-only) */
              <Badge variant={survey.status === 'active' ? 'default' : 'secondary'}>
                {tStatus(survey.status as 'draft' | 'active' | 'closed')}
              </Badge>
            ) : (
              /* Admin/Specialist: can change status */
              <Select
                value={survey.status}
                onValueChange={(value) => handleStatusChange(value as 'draft' | 'active' | 'closed')}
                disabled={updatingStatus}
              >
                <SelectTrigger className="w-28 sm:w-32 shrink-0">
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
            )}
            {isHRViewingHoldingSurvey && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {companyStats[0]?.company_name || 'Your Company'} - View Only
              </Badge>
            )}
          </div>
          {survey.description && (
            <p className="text-muted-foreground mt-1 text-sm sm:text-base line-clamp-2">{survey.description}</p>
          )}
        </div>
      </div>

      {/* Header Row 2: Action buttons - wraps on small screens */}
      <div className="flex flex-wrap gap-2">
          {/* Company Assignment Dialog for Holding Surveys - Admin/Specialist only */}
          {isHoldingSurvey && canManageHoldingSurvey && (
            <Dialog open={showCompanyAssignDialog} onOpenChange={setShowCompanyAssignDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 sm:gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('assignCompanies')}</span>
                  <span className="sm:hidden">({assignedCompanyIds.length})</span>
                  <span className="hidden sm:inline">({assignedCompanyIds.length})</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('assignCompaniesToSurvey')}</DialogTitle>
                  <DialogDescription>
                    {t('assignCompaniesDesc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="flex items-center gap-2 pb-3 border-b">
                    <Checkbox
                      id="select-all-companies"
                      checked={selectedCompaniesForAssign.length === allCompanies.length && allCompanies.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCompaniesForAssign(allCompanies.map(c => c.id))
                        } else {
                          setSelectedCompaniesForAssign([])
                        }
                      }}
                    />
                    <label htmlFor="select-all-companies" className="text-sm font-medium">
                      {t('selectAllCompanies', { count: allCompanies.length })}
                    </label>
                  </div>
                  <ScrollArea className="h-[400px] mt-3">
                    <div className="space-y-2">
                      {allCompanies.map((company) => (
                        <div key={company.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`company-${company.id}`}
                              checked={selectedCompaniesForAssign.includes(company.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedCompaniesForAssign([...selectedCompaniesForAssign, company.id])
                                } else {
                                  setSelectedCompaniesForAssign(selectedCompaniesForAssign.filter(id => id !== company.id))
                                }
                              }}
                            />
                            <label htmlFor={`company-${company.id}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{company.name}</span>
                              </div>
                            </label>
                            {assignedCompanyIds.includes(company.id) && (
                              <Badge variant="secondary" className="text-xs">
                                {t('assignedBadge')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {allCompanies.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {t('noCompanies')}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCompanyAssignDialog(false)}>
                    {tCommon('cancel')}
                  </Button>
                  <Button onClick={handleSaveCompanyAssignments} disabled={assigningCompanies}>
                    {assigningCompanies ? t('assignSaving') : t('assignCompaniesButton', { count: selectedCompaniesForAssign.length })}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {/* Employee Assignment Dialog for Company Surveys - not for HR on holding surveys */}
          {!isHoldingSurvey && (
            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('assignCount', { count: assignments.length })}</span>
                  <span className="sm:hidden ml-1">{assignments.length}</span>
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
          )}
          {/* Export, Report, AI Analysis - not for HR on holding surveys */}
          {!isHRViewingHoldingSurvey && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting || stats.completed === 0}
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{exporting ? t('exporting') : t('csv')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewReport}
                disabled={stats.completed === 0}
              >
                <FileDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('report')}</span>
              </Button>
              <AIAnalysisButton
                surveyId={surveyId}
                companyId={selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined}
                disabled={stats.completed === 0}
              />
            </>
          )}
          {/* Send Invitations - not for HR on holding surveys */}
          {!isHRViewingHoldingSurvey && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSendInvitations()}
              disabled={sendingInvitations || assignments.length === 0}
            >
              <Mail className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{sendingInvitations ? t('sendingInvitations') : t('sendInvitations')}</span>
            </Button>
          )}
          {/* Remind - not for HR on holding surveys */}
          {!isHRViewingHoldingSurvey && (
            <Button
              variant="outline"
              size="sm"
              onClick={mockNotify}
              disabled={sendingReminder || incompleteEmployees.length === 0}
            >
              <Bell className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{sendingReminder ? t('sending') : t('remind')}</span>
            </Button>
          )}
          {/* Edit - not for HR on holding surveys */}
          {!isHRViewingHoldingSurvey && (
            <Button asChild size="sm">
              <Link href={`/forms/${surveyId}/edit`}>
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('edit')}</span>
              </Link>
            </Button>
          )}
          {profile?.role === 'admin' && (
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

      {/* Company Filter for Holding Surveys - Admin/Specialist only (HR sees only their company) */}
      {isHoldingSurvey && canManageHoldingSurvey && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('filterByCompany')}:</span>
          </div>
          <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t('selectCompany')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('allCompanies')} ({assignedCompanyIds.length})
                </div>
              </SelectItem>
              {companyStats.map(cs => (
                <SelectItem key={cs.company_id} value={cs.company_id}>
                  <div className="flex items-center justify-between gap-4">
                    <span>{cs.company_name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {cs.completion_rate}%
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stats and Company Progress - Two Column Layout for Holding Surveys (Admin/Specialist only) */}
      <div className={`grid gap-4 sm:gap-6 ${isHoldingSurvey && canManageHoldingSurvey && selectedCompanyFilter === 'all' && companyStats.length > 0 ? 'lg:grid-cols-2' : ''}`}>
        {/* Compact Stats Cards - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Completion Rate Card */}
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('completion')}</span>
            </div>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <Progress value={completionRate} className="mt-2 h-1.5" />
          </div>

          {/* Completed Card */}
          <div className="relative overflow-hidden rounded-lg bg-green-50 dark:bg-green-950/20 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('completed')}</span>
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.completed}</div>
          </div>

          {/* In Progress Card */}
          <div className="relative overflow-hidden rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('inProgress')}</span>
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.partial}</div>
          </div>

          {/* Not Started Card */}
          <div className="relative overflow-hidden rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('notStarted')}</span>
            </div>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </div>
        </div>

        {/* Company Progress List - Right Column (Holding Surveys - Admin/Specialist Only) */}
        {isHoldingSurvey && canManageHoldingSurvey && selectedCompanyFilter === 'all' && companyStats.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('companyProgress')}</span>
              <Badge variant="secondary" className="ml-auto text-xs">{companyStats.length}</Badge>
            </div>
            <ScrollArea className="max-h-[180px]">
              <div className="divide-y">
                {companyStats.map(cs => (
                  <div
                    key={cs.company_id}
                    className="flex items-center gap-4 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedCompanyFilter(cs.company_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cs.company_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cs.total_completed}/{cs.total_assigned} {t('completed').toLowerCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Progress value={cs.completion_rate} className="w-20 h-1.5" />
                      <span className="text-sm font-semibold w-12 text-right tabular-nums">
                        {cs.completion_rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions">
            {t('questionsTab', { count: questions.length })}
          </TabsTrigger>
          {!isHRViewingHoldingSurvey && (
            <TabsTrigger value="responses">
              {t('responsesTab', { count: responses.length })}
            </TabsTrigger>
          )}
          <TabsTrigger value="pending">
            {t('pendingTab', { count: incompleteEmployees.length })}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            {t('invitationsTab', { count: invitations.length })}
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

        {!isHRViewingHoldingSurvey && (
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
                        <TableCell>{response.org_path || response.profile?.department || '-'}</TableCell>
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
        )}

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
                {!isHRViewingHoldingSurvey && (
                  <Button
                    onClick={mockNotify}
                    disabled={sendingReminder || incompleteEmployees.length === 0}
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    {t('sendReminderAll')}
                  </Button>
                )}
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

        <TabsContent value="invitations">
          {/* Invitation Statistics */}
          <div className="grid gap-4 md:grid-cols-5 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('invitationTotal')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invitationStats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Send className="h-4 w-4 text-blue-500" />
                  {t('invitationSent')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invitationStats.sent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  {t('invitationClicked')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invitationStats.clicked}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {t('invitationCompleted')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invitationStats.completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  {t('invitationFailed')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invitationStats.failed}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('invitationHistory')}</CardTitle>
                  <CardDescription>
                    {t('invitationHistoryDesc')}
                  </CardDescription>
                </div>
                {invitationStats.failed > 0 && (
                  <Button onClick={handleResendFailed} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t('resendFailed')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('sentAt')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('clickedAt')}</TableHead>
                    <TableHead>{t('reminders')}</TableHead>
                    <TableHead>{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invitation.profile?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {invitation.profile?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(invitation.sent_at), 'MMM d, yyyy')}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(invitation.sent_at), 'HH:mm')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getInvitationStatusIcon(invitation.status)}
                          <span className="text-sm">{getInvitationStatusText(invitation.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invitation.clicked_at ? (
                          <div className="text-sm">
                            {format(new Date(invitation.clicked_at), 'MMM d, yyyy')}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(invitation.clicked_at), 'HH:mm')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {invitation.retry_count || 0} / 3
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(invitation.status === 'failed' || invitation.status === 'bounced') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvitation(invitation.employee_id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {invitations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        {t('noInvitations')}
                        <p className="text-sm mt-2">{t('noInvitationsDesc')}</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tForms('messages.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tForms('messages.confirmDeleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? tCommon('loading') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}