import type { ChatContext } from '@/lib/ai/types'
import type { GetSurveyProgressInput, SurveyProgressResult } from '@/lib/ai/tools/get-survey-progress'
import type { GetNonRespondentsInput, NonRespondentsResult } from '@/lib/ai/tools/get-non-respondents'
import type { GetInvitationStatusInput, InvitationStatusResult } from '@/lib/ai/tools/get-invitation-status'
import type { GetSurveysInput, SurveyListResult } from '@/lib/ai/tools/get-surveys'
import type { GetCompaniesInput, CompanyListResult } from '@/lib/ai/tools/get-companies'
import type { CreateSurveyInput, CreateSurveyResult } from '@/lib/ai/tools/create-survey'
import type { AddSurveyQuestionsInput, AddSurveyQuestionsResult, QuestionInput } from '@/lib/ai/tools/add-survey-questions'
import type { AssignSurveyToCompaniesInput, AssignSurveyToCompaniesResult } from '@/lib/ai/tools/assign-survey-to-companies'

// --- Result types for Phase 2 tools ---

export interface SurveyStatusChangeResult {
  survey_id: string
  title: string
  previous_status: string
  new_status: string
}

export interface ReportDataResult {
  survey_id: string
  survey_title: string
  company_name: string
  question_count: number
  response_count: number
  completion_rate: number
  report_url: string
}

export interface SentimentTriggerResult {
  survey_id: string
  survey_title: string
  analysis_id: string
  responses_count: number
  status: string
  message: string
}

export interface SentimentResultsData {
  survey_id: string
  survey_title: string
  analysis_id: string
  status: string
  completed_at: string | null
  results: unknown | null
  error_message: string | null
}

interface SurveyRow {
  id: string
  title: string
  status: string
  scope: string | null
  company_id: string | null
}

export class SurveyNotFoundError extends Error {
  suggestions: string[]

  constructor(message: string, suggestions: string[] = []) {
    super(message)
    this.name = 'SurveyNotFoundError'
    this.suggestions = suggestions
  }
}

interface HoldingCompanyStat {
  company_id: string
  company_name: string
  total_assigned: number
  total_completed: number
  completion_rate: number
}

async function findSurveySuggestions(supabase: any, title: string): Promise<string[]> {
  const { data } = await supabase
    .from('surveys')
    .select('title')
    .ilike('title', `%${title}%`)
    .order('created_at', { ascending: false })
    .limit(5)

  if (data && data.length > 0) {
    return data.map((row: { title: string }) => row.title)
  }

  const words = title.split(/\s+/).filter(Boolean)
  if (words.length < 2) return []

  const { data: wordMatches } = await supabase
    .from('surveys')
    .select('title')
    .or(words.map((w) => `title.ilike.%${w}%`).join(','))
    .order('created_at', { ascending: false })
    .limit(5)

  return (wordMatches || []).map((row: { title: string }) => row.title)
}

async function getSurveyByInput(
  supabase: any,
  context: ChatContext,
  input: { surveyId?: string; title?: string; latest?: boolean }
): Promise<SurveyRow | null> {
  const { surveyId, title, latest } = input

  if (surveyId) {
    const { data } = await supabase
      .from('surveys')
      .select('id, title, status, scope, company_id')
      .eq('id', surveyId)
      .single()
    return data || null
  }

  if (title) {
    const { data } = await supabase
      .from('surveys')
      .select('id, title, status, scope, company_id')
      .ilike('title', `%${title}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return data || null
  }

  if (latest) {
    let query = supabase
      .from('surveys')
      .select('id, title, status, scope, company_id')
      .order('created_at', { ascending: false })
      .limit(1)

    if (context.role === 'hr' && context.companyId) {
      query = query.or(`scope.eq.holding,company_id.eq.${context.companyId}`)
    }

    const { data } = await query.single()
    return data || null
  }

  return null
}

export async function getSurveyProgress(
  supabase: any,
  context: ChatContext,
  input: GetSurveyProgressInput
): Promise<SurveyProgressResult> {
  const survey = await getSurveyByInput(supabase, context, input)

  if (!survey) {
    const suggestions = input.title
      ? await findSurveySuggestions(supabase, input.title)
      : []
    throw new SurveyNotFoundError(
      'Survey not found. Please provide a valid survey name or ID.',
      suggestions
    )
  }

  if (survey.scope === 'company') {
    if (context.role === 'hr' && context.companyId && survey.company_id !== context.companyId) {
      throw new Error('You can only view surveys within your company.')
    }

    const { data } = await supabase
      .from('survey_stats')
      .select('survey_id, title, status, scope, company_id, total_assigned, total_completed, completion_rate')
      .eq('survey_id', survey.id)
      .limit(1)
      .single()

    if (!data) {
      throw new Error('Survey progress data not available.')
    }

    return {
      summary: {
        survey_id: data.survey_id,
        title: data.title,
        status: data.status,
        scope: data.scope,
        total_assigned: Number(data.total_assigned) || 0,
        total_completed: Number(data.total_completed) || 0,
        completion_rate: Number(data.completion_rate) || 0,
      },
    }
  }

  // Holding survey logic
  let statsQuery = supabase
    .from('holding_survey_company_stats')
    .select('company_id, company_name, total_assigned, total_completed, completion_rate')
    .eq('survey_id', survey.id)

  if (context.role === 'hr' && context.companyId) {
    statsQuery = statsQuery.eq('company_id', context.companyId)
  }

  const { data: companyStats } = await statsQuery
  const stats = (companyStats || []) as HoldingCompanyStat[]

  const totalAssigned = stats.reduce((acc, s) => acc + (s.total_assigned || 0), 0)
  const totalCompleted = stats.reduce((acc, s) => acc + (s.total_completed || 0), 0)
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0

  return {
    summary: {
      survey_id: survey.id,
      title: survey.title,
      status: survey.status,
      scope: survey.scope,
      total_assigned: totalAssigned,
      total_completed: totalCompleted,
      completion_rate: completionRate,
    },
    by_company: stats.map((s) => ({
      company_id: s.company_id,
      company_name: s.company_name,
      total_assigned: Number(s.total_assigned) || 0,
      total_completed: Number(s.total_completed) || 0,
      completion_rate: Number(s.completion_rate) || 0,
    })),
  }
}

export async function getNonRespondents(
  supabase: any,
  context: ChatContext,
  input: GetNonRespondentsInput
): Promise<NonRespondentsResult> {
  const survey = await getSurveyByInput(supabase, context, input)

  if (!survey) {
    const suggestions = input.title
      ? await findSurveySuggestions(supabase, input.title)
      : []
    throw new SurveyNotFoundError(
      'Survey not found. Please provide a valid survey name or ID.',
      suggestions
    )
  }

  if (survey.scope === 'company') {
    if (context.role === 'hr' && context.companyId && survey.company_id !== context.companyId) {
      throw new Error('You can only view surveys within your company.')
    }
  }

  const { data } = await supabase.rpc('get_incomplete_survey_employees', {
    p_survey_id: survey.id,
  })

  const employees = (data || []).map((row: any) => ({
    employee_id: row.employee_id,
    full_name: row.full_name,
    email: row.email ?? null,
    department: row.department ?? null,
    response_status: row.response_status,
  }))

  let filtered = employees
  if (context.role === 'hr' && context.companyId) {
    const { data: companyEmployees } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', context.companyId)

    const allowed = new Set((companyEmployees || []).map((e: any) => e.id))
    filtered = employees.filter((e: any) => allowed.has(e.employee_id))
  }

  const limit = input.limit ?? 50

  return {
    survey_id: survey.id,
    survey_title: survey.title,
    count: filtered.length,
    employees: filtered.slice(0, limit),
  }
}

export async function getInvitationStatus(
  supabase: any,
  context: ChatContext,
  input: GetInvitationStatusInput
): Promise<InvitationStatusResult> {
  const survey = await getSurveyByInput(supabase, context, input)

  if (!survey) {
    const suggestions = input.title
      ? await findSurveySuggestions(supabase, input.title)
      : []
    throw new SurveyNotFoundError(
      'Survey not found. Please provide a valid survey name or ID.',
      suggestions
    )
  }

  if (survey.scope === 'company') {
    if (context.role === 'hr' && context.companyId && survey.company_id !== context.companyId) {
      throw new Error('You can only view surveys within your company.')
    }
  }

  let employeeIds: string[] | null = null
  if (context.role === 'hr' && context.companyId) {
    const { data: companyEmployees } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', context.companyId)
    const ids = (companyEmployees || []).map((e: any) => e.id)

    // If HR user has no employees in their company, return empty stats
    if (ids.length === 0) {
      return {
        survey_id: survey.id,
        survey_title: survey.title,
        total: 0, sent: 0, delivered: 0, clicked: 0, completed: 0, failed: 0, bounced: 0,
      }
    }
    employeeIds = ids
  }

  let query = supabase
    .from('survey_invitations')
    .select('status, clicked_at, completed_at, employee_id')
    .eq('survey_id', survey.id)

  if (employeeIds) {
    query = query.in('employee_id', employeeIds)
  }

  const { data } = await query
  const invitations = (data || []) as any[]

  const total = invitations.length
  const sent = invitations.filter(i => i.status === 'sent').length
  const delivered = invitations.filter(i => i.status === 'delivered').length
  const clicked = invitations.filter(i => i.clicked_at !== null).length
  const completed = invitations.filter(i => i.status === 'completed' || i.completed_at !== null).length
  const failed = invitations.filter(i => i.status === 'failed').length
  const bounced = invitations.filter(i => i.status === 'bounced').length

  return {
    survey_id: survey.id,
    survey_title: survey.title,
    total,
    sent,
    delivered,
    clicked,
    completed,
    failed,
    bounced,
  }
}

export async function getSurveys(
  supabase: any,
  context: ChatContext,
  input: GetSurveysInput
): Promise<SurveyListResult> {
  const status = input.status || 'all'
  const limit = input.limit || 10

  let query = supabase
    .from('surveys')
    .select('id, title, status, scope, deadline, created_at, company_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  if (context.role === 'hr' && context.companyId) {
    query = query.or(`scope.eq.holding,company_id.eq.${context.companyId}`)
  }

  const { data } = await query
  const items = (data || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    scope: s.scope,
    deadline: s.deadline,
    created_at: s.created_at,
  }))

  return {
    total: items.length,
    items,
  }
}

// --- Phase 2: Write tools ---

export type SurveyLookupInput = { surveyId?: string; title?: string; latest?: boolean }

export async function activateSurvey(
  supabase: any,
  context: ChatContext,
  input: SurveyLookupInput
): Promise<SurveyStatusChangeResult> {
  const survey = await getSurveyByInput(supabase, context, input)
  if (!survey) {
    const suggestions = input.title ? await findSurveySuggestions(supabase, input.title) : []
    throw new SurveyNotFoundError('Survey not found.', suggestions)
  }

  if (context.role === 'hr' && context.companyId && survey.company_id !== context.companyId) {
    throw new Error('You can only modify surveys within your company.')
  }

  if (survey.status !== 'draft') {
    throw new Error(`Cannot activate survey "${survey.title}" — it is currently "${survey.status}". Only draft surveys can be activated.`)
  }

  const { error } = await supabase
    .from('surveys')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', survey.id)

  if (error) throw new Error('Failed to activate survey.')

  return {
    survey_id: survey.id,
    title: survey.title,
    previous_status: 'draft',
    new_status: 'active',
  }
}

export async function closeSurvey(
  supabase: any,
  context: ChatContext,
  input: SurveyLookupInput
): Promise<SurveyStatusChangeResult> {
  const survey = await getSurveyByInput(supabase, context, input)
  if (!survey) {
    const suggestions = input.title ? await findSurveySuggestions(supabase, input.title) : []
    throw new SurveyNotFoundError('Survey not found.', suggestions)
  }

  if (context.role === 'hr' && context.companyId && survey.company_id !== context.companyId) {
    throw new Error('You can only modify surveys within your company.')
  }

  if (survey.status !== 'active') {
    throw new Error(`Cannot close survey "${survey.title}" — it is currently "${survey.status}". Only active surveys can be closed.`)
  }

  const { error } = await supabase
    .from('surveys')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', survey.id)

  if (error) throw new Error('Failed to close survey.')

  return {
    survey_id: survey.id,
    title: survey.title,
    previous_status: 'active',
    new_status: 'closed',
  }
}

export async function getReportData(
  supabase: any,
  context: ChatContext,
  input: SurveyLookupInput
): Promise<ReportDataResult> {
  const survey = await getSurveyByInput(supabase, context, input)
  if (!survey) {
    const suggestions = input.title ? await findSurveySuggestions(supabase, input.title) : []
    throw new SurveyNotFoundError('Survey not found.', suggestions)
  }

  if (context.role === 'hr' && context.companyId && survey.company_id !== context.companyId) {
    throw new Error('You can only access reports within your company.')
  }

  // Count questions
  const { count: questionCount } = await supabase
    .from('survey_questions')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', survey.id)

  // Count completed responses
  const { count: responseCount } = await supabase
    .from('survey_responses')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', survey.id)
    .eq('status', 'completed')

  // Count assignments
  const { count: assignedCount } = await supabase
    .from('survey_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', survey.id)

  const totalAssigned = assignedCount || 0
  const totalCompleted = responseCount || 0
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0

  // Get company name
  let companyName = ''
  if (survey.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', survey.company_id)
      .single()
    companyName = company?.name || ''
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return {
    survey_id: survey.id,
    survey_title: survey.title,
    company_name: companyName,
    question_count: questionCount || 0,
    response_count: totalCompleted,
    completion_rate: completionRate,
    report_url: `${baseUrl}/forms/${survey.id}/report`,
  }
}

export async function triggerSentimentAnalysis(
  supabase: any,
  context: ChatContext,
  input: SurveyLookupInput
): Promise<SentimentTriggerResult> {
  const survey = await getSurveyByInput(supabase, context, input)
  if (!survey) {
    const suggestions = input.title ? await findSurveySuggestions(supabase, input.title) : []
    throw new SurveyNotFoundError('Survey not found.', suggestions)
  }

  // Only admin and specialist can trigger analysis
  if (!['admin', 'specialist'].includes(context.role)) {
    throw new Error('Only administrators and specialists can request AI analysis.')
  }

  // Check for existing pending/processing analysis
  const { data: existingAnalysis } = await supabase
    .from('survey_sentiment_analyses')
    .select('id, status')
    .eq('survey_id', survey.id)
    .in('status', ['pending', 'processing'])
    .limit(1)
    .maybeSingle()

  if (existingAnalysis) {
    return {
      survey_id: survey.id,
      survey_title: survey.title,
      analysis_id: existingAnalysis.id,
      responses_count: 0,
      status: existingAnalysis.status,
      message: `An analysis is already ${existingAnalysis.status} for "${survey.title}".`,
    }
  }

  // Count completed responses
  const { count: responseCount } = await supabase
    .from('survey_responses')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', survey.id)
    .eq('status', 'completed')

  if (!responseCount || responseCount === 0) {
    throw new Error(`No completed responses found for "${survey.title}". Cannot run sentiment analysis on empty data.`)
  }

  return {
    survey_id: survey.id,
    survey_title: survey.title,
    analysis_id: '', // Will be created by the actual API call
    responses_count: responseCount,
    status: 'ready',
    message: `Ready to analyze ${responseCount} responses for "${survey.title}".`,
  }
}

export async function getSentimentResults(
  supabase: any,
  context: ChatContext,
  input: SurveyLookupInput
): Promise<SentimentResultsData> {
  const survey = await getSurveyByInput(supabase, context, input)
  if (!survey) {
    const suggestions = input.title ? await findSurveySuggestions(supabase, input.title) : []
    throw new SurveyNotFoundError('Survey not found.', suggestions)
  }

  if (context.role === 'hr' && context.companyId && survey.company_id !== context.companyId) {
    throw new Error('You can only access analysis results within your company.')
  }

  const { data: analysis } = await supabase
    .from('survey_sentiment_analyses')
    .select('id, status, completed_at, results, error_message')
    .eq('survey_id', survey.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!analysis) {
    throw new Error(`No sentiment analysis found for "${survey.title}". You can trigger one using the sentiment analysis tool.`)
  }

  return {
    survey_id: survey.id,
    survey_title: survey.title,
    analysis_id: analysis.id,
    status: analysis.status,
    completed_at: analysis.completed_at,
    results: analysis.results,
    error_message: analysis.error_message,
  }
}

// --- Phase 3: Survey creation workflow ---

export async function getCompanies(
  supabase: any,
  context: ChatContext,
  _input: GetCompaniesInput
): Promise<CompanyListResult> {
  if (!['admin', 'specialist'].includes(context.role)) {
    throw new Error('Only administrators and specialists can list companies.')
  }

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, industry')
    .order('name', { ascending: true })

  if (!companies || companies.length === 0) {
    return { total: 0, companies: [] }
  }

  // Get employee counts per company
  const companyIds = companies.map((c: any) => c.id)
  const { data: counts } = await supabase
    .from('profiles')
    .select('company_id')
    .in('company_id', companyIds)
    .eq('role', 'employee')

  const countMap: Record<string, number> = {}
  for (const row of counts || []) {
    countMap[row.company_id] = (countMap[row.company_id] || 0) + 1
  }

  return {
    total: companies.length,
    companies: companies.map((c: any) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      employee_count: countMap[c.id] || 0,
    })),
  }
}

export async function createSurvey(
  supabase: any,
  context: ChatContext,
  input: CreateSurveyInput
): Promise<CreateSurveyResult> {
  if (!['admin', 'specialist'].includes(context.role)) {
    throw new Error('Only administrators and specialists can create surveys.')
  }

  // Specialists can only create holding-scope surveys
  if (input.scope === 'company' && context.role === 'specialist') {
    throw new Error('Specialists can only create holding-scope surveys. Use scope "holding".')
  }

  // Company-scope surveys need a companyId
  if (input.scope === 'company' && !input.companyId) {
    throw new Error('Company-scope surveys require a companyId. Use get_companies to see available companies.')
  }

  const insertData: Record<string, unknown> = {
    title: input.title,
    scope: input.scope || 'holding',
    status: 'draft',
    description: input.description || null,
    deadline: input.deadline || null,
    created_by: context.userId,
    created_by_role: context.role,
    company_id: input.scope === 'company' ? input.companyId : null,
    settings: {},
  }

  const { data, error } = await supabase
    .from('surveys')
    .insert(insertData)
    .select('id, title, scope, status, description, deadline')
    .single()

  if (error || !data) {
    throw new Error('Failed to create survey: ' + (error?.message || 'Unknown error'))
  }

  return {
    survey_id: data.id,
    title: data.title,
    scope: data.scope,
    status: data.status,
    description: data.description,
    deadline: data.deadline,
  }
}

export async function addSurveyQuestions(
  supabase: any,
  context: ChatContext,
  input: AddSurveyQuestionsInput
): Promise<AddSurveyQuestionsResult> {
  if (!['admin', 'specialist'].includes(context.role)) {
    throw new Error('Only administrators and specialists can add survey questions.')
  }

  // Validate survey exists and is draft
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, title, status, scope, company_id')
    .eq('id', input.surveyId)
    .single()

  if (!survey) {
    throw new Error('Survey not found.')
  }

  if (survey.status !== 'draft') {
    throw new Error(`Cannot add questions to survey "${survey.title}" — it is currently "${survey.status}". Only draft surveys can be modified.`)
  }

  // Validate choice-type questions have options
  for (const q of input.questions) {
    if (['multiple_choice', 'single_choice'].includes(q.type) && (!q.options || q.options.length < 2)) {
      throw new Error(`Question "${q.question_code}" is type "${q.type}" but has fewer than 2 options. Choice questions require at least 2 options.`)
    }
  }

  // Get existing question count for ordering
  const { count: existingCount } = await supabase
    .from('survey_questions')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', input.surveyId)

  const startOrder = (existingCount || 0) + 1

  // Build rows with incrementing order
  const rows = input.questions.map((q: QuestionInput, index: number) => ({
    survey_id: input.surveyId,
    question_code: q.question_code,
    question_text: q.question_text,
    type: q.type,
    options: q.options ? JSON.stringify(q.options) : '[]',
    section_name: q.section_name || null,
    question_order: startOrder + index,
    is_required: q.is_required ?? true,
    description: q.description || null,
  }))

  const { error } = await supabase
    .from('survey_questions')
    .insert(rows)

  if (error) {
    throw new Error('Failed to add questions: ' + error.message)
  }

  return {
    survey_id: input.surveyId,
    survey_title: survey.title,
    questions_added: input.questions.length,
    total_questions: (existingCount || 0) + input.questions.length,
  }
}

export async function assignSurveyToCompanies(
  supabase: any,
  context: ChatContext,
  input: AssignSurveyToCompaniesInput
): Promise<AssignSurveyToCompaniesResult> {
  if (!['admin', 'specialist'].includes(context.role)) {
    throw new Error('Only administrators and specialists can assign surveys to companies.')
  }

  // Validate survey exists, is holding scope, and is draft
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, title, status, scope')
    .eq('id', input.surveyId)
    .single()

  if (!survey) {
    throw new Error('Survey not found.')
  }

  if (survey.scope !== 'holding') {
    throw new Error(`Survey "${survey.title}" is company-scope. Only holding-scope surveys can be assigned to multiple companies.`)
  }

  if (survey.status !== 'draft') {
    throw new Error(`Cannot assign companies to survey "${survey.title}" — it is currently "${survey.status}". Only draft surveys can be assigned.`)
  }

  // Check for already-assigned companies
  const { data: existingAssignments } = await supabase
    .from('survey_company_assignments')
    .select('company_id')
    .eq('survey_id', input.surveyId)

  const alreadyAssigned = new Set((existingAssignments || []).map((a: any) => a.company_id))
  const newCompanyIds = input.companyIds.filter((id) => !alreadyAssigned.has(id))

  if (newCompanyIds.length === 0) {
    throw new Error('All specified companies are already assigned to this survey.')
  }

  // Insert company assignments
  const companyAssignmentRows = newCompanyIds.map((companyId) => ({
    survey_id: input.surveyId,
    company_id: companyId,
    assigned_by: context.userId,
  }))

  const { error: companyError } = await supabase
    .from('survey_company_assignments')
    .insert(companyAssignmentRows)

  if (companyError) {
    throw new Error('Failed to assign companies: ' + companyError.message)
  }

  // Fetch employees from those companies (role = employee only)
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, company_id')
    .in('company_id', newCompanyIds)
    .eq('role', 'employee')

  const employeeList = employees || []

  // Check for existing employee assignments to avoid duplicates
  const existingEmployeeAssignments = new Set<string>()
  if (employeeList.length > 0) {
    const { data: existingEmpAssigns } = await supabase
      .from('survey_assignments')
      .select('employee_id')
      .eq('survey_id', input.surveyId)

    for (const a of existingEmpAssigns || []) {
      existingEmployeeAssignments.add(a.employee_id)
    }
  }

  const newEmployees = employeeList.filter((e: any) => !existingEmployeeAssignments.has(e.id))

  // Insert employee assignments
  if (newEmployees.length > 0) {
    const employeeAssignmentRows = newEmployees.map((e: any) => ({
      survey_id: input.surveyId,
      employee_id: e.id,
      assigned_by: context.userId,
    }))

    const { error: empError } = await supabase
      .from('survey_assignments')
      .insert(employeeAssignmentRows)

    if (empError) {
      throw new Error('Companies assigned but failed to create employee assignments: ' + empError.message)
    }
  }

  // Get company names and per-company employee counts
  const { data: companyData } = await supabase
    .from('companies')
    .select('id, name')
    .in('id', newCompanyIds)

  const companyNameMap: Record<string, string> = {}
  for (const c of companyData || []) {
    companyNameMap[c.id] = c.name
  }

  const perCompanyCounts: Record<string, number> = {}
  for (const e of newEmployees) {
    perCompanyCounts[e.company_id] = (perCompanyCounts[e.company_id] || 0) + 1
  }

  return {
    survey_id: input.surveyId,
    survey_title: survey.title,
    companies_assigned: newCompanyIds.length,
    employees_assigned: newEmployees.length,
    company_details: newCompanyIds.map((id) => ({
      company_id: id,
      company_name: companyNameMap[id] || 'Unknown',
      employee_count: perCompanyCounts[id] || 0,
    })),
  }
}
