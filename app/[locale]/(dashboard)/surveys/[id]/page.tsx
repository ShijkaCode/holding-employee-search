'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { ArrowLeft, Save, Send, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'

interface Survey {
  id: string
  title: string
  description: string | null
  deadline: string | null
}

interface Question {
  id: string
  question_code: string
  question_text: string
  type: string
  section_name: string | null
  is_required: boolean | null
  options: string[] | null
  description: string | null
}

export default function FillSurveyPage() {
  const params = useParams()
  const router = useRouter()
  const { user, profile } = useAuth()
  const surveyId = params.id as string
  const t = useTranslations('SurveyTaking')
  const tCommon = useTranslations('Common')

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [responseId, setResponseId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      setLoading(true)

      // Fetch survey
      const { data: surveyData } = await supabase
        .from('surveys')
        .select('id, title, description, deadline')
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

      const mappedQuestions = (questionsData || []).map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? (q.options as string[]) : null,
      }))
      setQuestions(mappedQuestions)

      // Fetch existing response
      const { data: responseData } = await supabase
        .from('survey_responses')
        .select('id, answers, status')
        .eq('survey_id', surveyId)
        .eq('employee_id', user.id)
        .single()

      if (responseData) {
        setResponseId(responseData.id)
        setAnswers((responseData.answers as Record<string, string | string[]>) || {})
      }

      setLoading(false)
    }

    fetchData()
  }, [surveyId, user, supabase])

  const updateAnswer = (questionCode: string, value: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionCode]: value,
    }))
  }

  const handleMultipleChoice = (questionCode: string, option: string, checked: boolean) => {
    const current = (answers[questionCode] as string[]) || []
    if (checked) {
      updateAnswer(questionCode, [...current, option])
    } else {
      updateAnswer(questionCode, current.filter((o) => o !== option))
    }
  }

  const saveProgress = async () => {
    if (!user || !profile?.company_id) return

    setSaving(true)

    try {
      if (responseId) {
        // Update existing response
        const { error } = await supabase
          .from('survey_responses')
          .update({
            answers,
            status: 'partial',
            last_saved_at: new Date().toISOString(),
          })
          .eq('id', responseId)

        if (error) throw error
      } else {
        // Create new response
        const { data, error } = await supabase
          .from('survey_responses')
          .insert({
            survey_id: surveyId,
            employee_id: user.id,
            company_id: profile.company_id,
            answers,
            status: 'partial',
          })
          .select()
          .single()

        if (error) throw error
        setResponseId(data.id)
      }

      toast.success(t('progressSaved'))
    } catch (error) {
      console.error('Error saving progress:', error)
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const submitSurvey = async () => {
    if (!user || !profile?.company_id) return

    // Validate required questions
    const requiredQuestions = questions.filter((q) => q.is_required)
    const unanswered = requiredQuestions.filter(
      (q) => !answers[q.question_code] ||
        (Array.isArray(answers[q.question_code]) && (answers[q.question_code] as string[]).length === 0)
    )

    if (unanswered.length > 0) {
      toast.error(t('requiredRemaining', { count: unanswered.length }))
      return
    }

    setSubmitting(true)

    try {
      if (responseId) {
        const { error } = await supabase
          .from('survey_responses')
          .update({
            answers,
            status: 'completed',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', responseId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('survey_responses').insert({
          survey_id: surveyId,
          employee_id: user.id,
          company_id: profile.company_id,
          answers,
          status: 'completed',
          submitted_at: new Date().toISOString(),
        })

        if (error) throw error
      }

      toast.success(t('submitted'))
      router.push('/surveys')
    } catch (error) {
      console.error('Error submitting survey:', error)
      toast.error(t('submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  const answeredCount = Object.keys(answers).filter(
    (k) => answers[k] && (!Array.isArray(answers[k]) || (answers[k] as string[]).length > 0)
  ).length
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

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
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="p-6">
        <Card className="flex flex-col items-center justify-center py-12">
          <CardTitle className="mb-2">{t('surveyNotFound')}</CardTitle>
          <CardDescription className="mb-4">
            {t('surveyNotFoundDesc')}
          </CardDescription>
          <Button onClick={() => router.push('/surveys')}>
            {t('backToSurveys')}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/surveys')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{survey.title}</h1>
          {survey.description && (
            <p className="text-muted-foreground mt-1">{survey.description}</p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {t('progress', { answered: answeredCount, total: questions.length })}
            </span>
            <span className="text-sm font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {survey.deadline && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{t('due', { date: format(new Date(survey.deadline), 'MMMM d, yyyy') })}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="space-y-6 pr-4">
          {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
            <Card key={section}>
              <CardHeader>
                <CardTitle>{section}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {sectionQuestions.map((question) => (
                  <div key={question.id} className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {question.question_code}
                      </Badge>
                      <div>
                        <Label className="text-base">
                          {question.question_text}
                          {question.is_required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </Label>
                        {question.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {question.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {question.type === 'text' && (
                      <Textarea
                        placeholder={t('enterAnswer')}
                        value={(answers[question.question_code] as string) || ''}
                        onChange={(e) => updateAnswer(question.question_code, e.target.value)}
                      />
                    )}

                    {question.type === 'scale' && (
                      <RadioGroup
                        value={(answers[question.question_code] as string) || ''}
                        onValueChange={(value) => updateAnswer(question.question_code, value)}
                        className="flex gap-4"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div key={n} className="flex flex-col items-center gap-1">
                            <RadioGroupItem value={String(n)} id={`${question.id}-${n}`} />
                            <Label htmlFor={`${question.id}-${n}`} className="text-sm">
                              {n}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {question.type === 'rating' && (
                      <RadioGroup
                        value={(answers[question.question_code] as string) || ''}
                        onValueChange={(value) => updateAnswer(question.question_code, value)}
                        className="flex gap-2"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div key={n} className="flex items-center gap-1">
                            <RadioGroupItem value={String(n)} id={`${question.id}-${n}`} />
                            <Label htmlFor={`${question.id}-${n}`}>{'★'.repeat(n)}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {question.type === 'single_choice' && question.options && (
                      <RadioGroup
                        value={(answers[question.question_code] as string) || ''}
                        onValueChange={(value) => updateAnswer(question.question_code, value)}
                        className="space-y-2"
                      >
                        {question.options.map((option, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                            <Label htmlFor={`${question.id}-${i}`}>{option}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {question.type === 'multiple_choice' && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Checkbox
                              id={`${question.id}-${i}`}
                              checked={((answers[question.question_code] as string[]) || []).includes(option)}
                              onCheckedChange={(checked) =>
                                handleMultipleChoice(question.question_code, option, checked as boolean)
                              }
                            />
                            <Label htmlFor={`${question.id}-${i}`}>{option}</Label>
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === 'date' && (
                      <Input
                        type="date"
                        value={(answers[question.question_code] as string) || ''}
                        onChange={(e) => updateAnswer(question.question_code, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button variant="outline" onClick={saveProgress} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? tCommon('loading') : t('saveProgress')}
        </Button>
        <Button onClick={submitSurvey} disabled={submitting}>
          <Send className="mr-2 h-4 w-4" />
          {submitting ? tCommon('loading') : t('submitSurvey')}
        </Button>
      </div>
    </div>
  )
}
