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
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-6 sm:h-8 w-48 sm:w-64" />
        <Skeleton className="h-64 sm:h-96" />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="p-3 sm:p-6">
        <Card className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
          <CardTitle className="mb-2 text-center text-lg sm:text-xl">{t('surveyNotFound')}</CardTitle>
          <CardDescription className="mb-4 text-center text-sm">
            {t('surveyNotFoundDesc')}
          </CardDescription>
          <Button onClick={() => router.push('/surveys')} className="w-full sm:w-auto">
            {t('backToSurveys')}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Sticky on mobile */}
      <div className="sticky top-0 z-10 bg-background border-b p-3 sm:p-4 space-y-3">
        <div className="flex items-start gap-2 sm:gap-4 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => router.push('/surveys')} className="shrink-0 h-8 w-8 sm:h-10 sm:w-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight line-clamp-2">{survey.title}</h1>
            {survey.description && (
              <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{survey.description}</p>
            )}
          </div>
        </div>

        {/* Progress - Always visible */}
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-1.5 text-xs sm:text-sm">
            <span className="text-muted-foreground">
              {t('progress', { answered: answeredCount, total: questions.length })}
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5 sm:h-2" />
          {survey.deadline && (
            <div className="flex items-center gap-1.5 mt-2 text-xs sm:text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{t('due', { date: format(new Date(survey.deadline), 'MMM d, yyyy') })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Questions - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-6 pb-24 sm:pb-28 max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
            <Card key={section} className="overflow-hidden">
              <CardHeader className="py-3 sm:py-4 px-3 sm:px-6 bg-muted/30">
                <CardTitle className="text-base sm:text-lg">{section}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 space-y-5 sm:space-y-6">
                {sectionQuestions.map((question) => (
                  <div key={question.id} className="space-y-2.5 sm:space-y-3">
                    {/* Question header */}
                    <div className="space-y-1">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0 text-xs px-1.5 py-0.5">
                          {question.question_code}
                        </Badge>
                        {question.is_required && (
                          <span className="text-red-500 text-sm">*</span>
                        )}
                      </div>
                      <Label className="text-sm sm:text-base font-medium leading-relaxed block">
                        {question.question_text}
                      </Label>
                      {question.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {question.description}
                        </p>
                      )}
                    </div>

                    {/* Text input */}
                    {question.type === 'text' && (
                      <Textarea
                        placeholder={t('enterAnswer')}
                        value={(answers[question.question_code] as string) || ''}
                        onChange={(e) => updateAnswer(question.question_code, e.target.value)}
                        className="min-h-[100px] text-base"
                      />
                    )}

                    {/* Scale 1-5 - Mobile optimized grid */}
                    {question.type === 'scale' && (
                      <RadioGroup
                        value={(answers[question.question_code] as string) || ''}
                        onValueChange={(value) => updateAnswer(question.question_code, value)}
                        className="grid grid-cols-5 gap-1 sm:gap-2"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Label
                            key={n}
                            htmlFor={`${question.id}-${n}`}
                            className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg border-2 cursor-pointer transition-all
                              ${answers[question.question_code] === String(n)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-muted hover:border-primary/50'
                              }`}
                          >
                            <RadioGroupItem value={String(n)} id={`${question.id}-${n}`} className="sr-only" />
                            <span className="text-lg sm:text-xl font-semibold">{n}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    )}

                    {/* Rating stars - Mobile optimized */}
                    {question.type === 'rating' && (
                      <RadioGroup
                        value={(answers[question.question_code] as string) || ''}
                        onValueChange={(value) => updateAnswer(question.question_code, value)}
                        className="flex flex-wrap gap-2"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Label
                            key={n}
                            htmlFor={`${question.id}-${n}`}
                            className={`flex items-center justify-center px-3 py-2 rounded-lg border-2 cursor-pointer transition-all
                              ${answers[question.question_code] === String(n)
                                ? 'border-primary bg-primary/10'
                                : 'border-muted hover:border-primary/50'
                              }`}
                          >
                            <RadioGroupItem value={String(n)} id={`${question.id}-${n}`} className="sr-only" />
                            <span className="text-amber-500 text-sm sm:text-base">{'★'.repeat(n)}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    )}

                    {/* Single choice - Touch friendly */}
                    {question.type === 'single_choice' && question.options && (
                      <RadioGroup
                        value={(answers[question.question_code] as string) || ''}
                        onValueChange={(value) => updateAnswer(question.question_code, value)}
                        className="space-y-2"
                      >
                        {question.options.map((option, i) => (
                          <Label
                            key={i}
                            htmlFor={`${question.id}-${i}`}
                            className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all
                              ${answers[question.question_code] === option
                                ? 'border-primary bg-primary/10'
                                : 'border-muted hover:border-primary/50'
                              }`}
                          >
                            <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                            <span className="text-sm sm:text-base">{option}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    )}

                    {/* Multiple choice - Touch friendly */}
                    {question.type === 'multiple_choice' && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option, i) => {
                          const isChecked = ((answers[question.question_code] as string[]) || []).includes(option)
                          return (
                            <Label
                              key={i}
                              htmlFor={`${question.id}-${i}`}
                              className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all
                                ${isChecked
                                  ? 'border-primary bg-primary/10'
                                  : 'border-muted hover:border-primary/50'
                                }`}
                            >
                              <Checkbox
                                id={`${question.id}-${i}`}
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  handleMultipleChoice(question.question_code, option, checked as boolean)
                                }
                              />
                              <span className="text-sm sm:text-base">{option}</span>
                            </Label>
                          )
                        })}
                      </div>
                    )}

                    {/* Date input */}
                    {question.type === 'date' && (
                      <Input
                        type="date"
                        value={(answers[question.question_code] as string) || ''}
                        onChange={(e) => updateAnswer(question.question_code, e.target.value)}
                        className="text-base h-12"
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Sticky footer - Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 sm:p-4 safe-area-bottom">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-2 sm:gap-4 sm:justify-end">
          <Button
            variant="outline"
            onClick={saveProgress}
            disabled={saving}
            className="w-full sm:w-auto h-11 sm:h-10 text-base sm:text-sm"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? tCommon('loading') : t('saveProgress')}
          </Button>
          <Button
            onClick={submitSurvey}
            disabled={submitting}
            className="w-full sm:w-auto h-11 sm:h-10 text-base sm:text-sm"
          >
            <Send className="mr-2 h-4 w-4" />
            {submitting ? tCommon('loading') : t('submitSurvey')}
          </Button>
        </div>
      </div>
    </div>
  )
}
