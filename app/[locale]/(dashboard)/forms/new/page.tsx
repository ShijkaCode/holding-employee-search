'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  FileText,
  Type,
  List,
  Star,
  Calendar,
  Upload,
  Hash,
  Building2,
  Globe,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

const questionTypeIcons = {
  text: Type,
  scale: Hash,
  single_choice: List,
  multiple_choice: List,
  rating: Star,
  date: Calendar,
  file: Upload,
}

const createQuestionSchema = (t: (key: string) => string) => z.object({
  question_code: z.string().min(1, t('validation.questionCodeRequired')),
  question_text: z.string().min(1, t('validation.questionTextRequired')),
  type: z.enum(['text', 'scale', 'multiple_choice', 'single_choice', 'file', 'rating', 'date']),
  section_name: z.string().optional(),
  is_required: z.boolean(),
  options: z.array(z.string()).optional(),
  description: z.string().optional(),
})

const createFormSchema = (t: (key: string) => string) => z.object({
  title: z.string().min(1, t('validation.titleRequired')),
  description: z.string().optional(),
  deadline: z.string().optional(),
  scope: z.enum(['company', 'holding']),
  questions: z.array(createQuestionSchema(t)).min(1, t('validation.atLeastOneQuestion')),
})

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

export default function NewFormPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [currentSection, setCurrentSection] = useState('')
  const [newOption, setNewOption] = useState('')
  const t = useTranslations('FormBuilder')
  const tTypes = useTranslations('QuestionTypes')
  const tCommon = useTranslations('Common')

  const questionTypes = [
    { value: 'text', label: tTypes('text'), icon: questionTypeIcons.text },
    { value: 'scale', label: tTypes('scale'), icon: questionTypeIcons.scale },
    { value: 'single_choice', label: tTypes('singleChoice'), icon: questionTypeIcons.single_choice },
    { value: 'multiple_choice', label: tTypes('multipleChoice'), icon: questionTypeIcons.multiple_choice },
    { value: 'rating', label: tTypes('rating'), icon: questionTypeIcons.rating },
    { value: 'date', label: tTypes('date'), icon: questionTypeIcons.date },
    { value: 'file', label: tTypes('file'), icon: questionTypeIcons.file },
  ]

  const supabase = createClient()
  const formSchema = createFormSchema(t)

  // Check if user can create holding surveys
  const canCreateHoldingSurvey = profile?.role === 'admin' || profile?.role === 'specialist'

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      deadline: '',
      scope: 'company',
      questions: [],
    },
  })

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'questions',
  })

  const [tempQuestion, setTempQuestion] = useState({
    question_code: '',
    question_text: '',
    type: 'text' as const,
    section_name: '',
    is_required: true,
    options: [] as string[],
    description: '',
  })

  const handleAddQuestion = () => {
    if (!tempQuestion.question_code || !tempQuestion.question_text) {
      toast.error(t('fillRequired'))
      return
    }

    append({
      ...tempQuestion,
      section_name: tempQuestion.section_name || currentSection,
    })

    setTempQuestion({
      question_code: '',
      question_text: '',
      type: 'text',
      section_name: currentSection,
      is_required: true,
      options: [],
      description: '',
    })

    setShowAddQuestion(false)
    toast.success(t('questionAdded'))
  }

  const handleAddOption = () => {
    if (newOption.trim()) {
      setTempQuestion({
        ...tempQuestion,
        options: [...tempQuestion.options, newOption.trim()],
      })
      setNewOption('')
    }
  }

  const handleRemoveOption = (index: number) => {
    setTempQuestion({
      ...tempQuestion,
      options: tempQuestion.options.filter((_, i) => i !== index),
    })
  }

  const onSubmit = async (data: FormValues) => {
    // For company surveys, company_id is required
    // For holding surveys, company_id is null
    const isHolding = data.scope === 'holding'

    if (!isHolding && !profile?.company_id) {
      toast.error(t('noCompany'))
      return
    }

    setSaving(true)

    try {
      // Create survey
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .insert({
          title: data.title,
          description: data.description || null,
          deadline: data.deadline || null,
          company_id: isHolding ? null : profile?.company_id,
          created_by: profile?.id,
          created_by_role: profile?.role,
          scope: data.scope,
          status: 'draft',
        })
        .select()
        .single()

      if (surveyError) throw surveyError

      // Create questions
      const questionsToInsert = data.questions.map((q, index) => ({
        survey_id: survey.id,
        question_code: q.question_code,
        question_text: q.question_text,
        type: q.type,
        section_name: q.section_name || null,
        section_order: getSectionOrder(q.section_name || '', data.questions),
        question_order: index,
        is_required: q.is_required,
        options: q.options && q.options.length > 0 ? q.options : null,
        description: q.description || null,
      }))

      const { error: questionsError } = await supabase
        .from('survey_questions')
        .insert(questionsToInsert)

      if (questionsError) throw questionsError

      toast.success(t('surveyCreated'))
      router.push(`/forms/${survey.id}`)
    } catch (error) {
      console.error('Error creating survey:', error)
      toast.error(t('createError'))
    } finally {
      setSaving(false)
    }
  }

  const getSectionOrder = (sectionName: string, questions: { section_name?: string }[]) => {
    const sections = [...new Set(questions.map((q) => q.section_name || ''))]
    return sections.indexOf(sectionName)
  }

  const groupedQuestions = fields.reduce((acc, field, index) => {
    const section = field.section_name || 'General'
    if (!acc[section]) acc[section] = []
    acc[section].push({ ...field, index })
    return acc
  }, {} as Record<string, (typeof fields[0] & { index: number })[]>)

  const sections = [...new Set(fields.map((f) => f.section_name || 'General'))]

  return (
    <div className="page-container">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('createNew')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('buildSurvey')}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('formDetails')}</CardTitle>
              <CardDescription>
                {t('basicInfo')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('titleRequired')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('titlePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('descriptionPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('deadline')}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {canCreateHoldingSurvey && (
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('surveyScope')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectScope')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="company">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <div>
                                <span className="font-medium">{t('scopeCompany')}</span>
                                <p className="text-xs text-muted-foreground">{t('scopeCompanyDesc')}</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="holding">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              <div>
                                <span className="font-medium">{t('scopeHolding')}</span>
                                <p className="text-xs text-muted-foreground">{t('scopeHoldingDesc')}</p>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {field.value === 'holding' ? t('scopeHoldingHelp') : t('scopeCompanyHelp')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('questions')}</CardTitle>
                  <CardDescription>
                    {t('questionsDesc')}
                  </CardDescription>
                </div>
                <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('addQuestion')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{t('addQuestion')}</DialogTitle>
                      <DialogDescription>
                        {t('addQuestionDesc')}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('questionCodeRequired')}</Label>
                          <Input
                            placeholder={t('questionCodePlaceholder')}
                            value={tempQuestion.question_code}
                            onChange={(e) =>
                              setTempQuestion({
                                ...tempQuestion,
                                question_code: e.target.value,
                              })
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t('questionCodeHelp')}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>{t('sectionName')}</Label>
                          <Input
                            placeholder={t('sectionPlaceholder')}
                            value={tempQuestion.section_name}
                            onChange={(e) => {
                              setTempQuestion({
                                ...tempQuestion,
                                section_name: e.target.value,
                              })
                              setCurrentSection(e.target.value)
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('questionTextRequired')}</Label>
                        <Textarea
                          placeholder={t('questionTextPlaceholder')}
                          value={tempQuestion.question_text}
                          onChange={(e) =>
                            setTempQuestion({
                              ...tempQuestion,
                              question_text: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('questionType')}</Label>
                          <Select
                            value={tempQuestion.type}
                            onValueChange={(value: typeof tempQuestion.type) =>
                              setTempQuestion({ ...tempQuestion, type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {questionTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center gap-2">
                                    <type.icon className="h-4 w-4" />
                                    {type.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>{t('required')}</Label>
                          <Select
                            value={tempQuestion.is_required ? 'yes' : 'no'}
                            onValueChange={(value) =>
                              setTempQuestion({
                                ...tempQuestion,
                                is_required: value === 'yes',
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="yes">{t('required')}</SelectItem>
                              <SelectItem value="no">{t('optional')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {['single_choice', 'multiple_choice'].includes(tempQuestion.type) && (
                        <div className="space-y-2">
                          <Label>{t('options')}</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder={t('addOption')}
                              value={newOption}
                              onChange={(e) => setNewOption(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleAddOption()
                                }
                              }}
                            />
                            <Button type="button" onClick={handleAddOption}>
                              {t('add')}
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {tempQuestion.options.map((option, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="cursor-pointer"
                                onClick={() => handleRemoveOption(i)}
                              >
                                {option} ×
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>{t('descriptionOptional')}</Label>
                        <Textarea
                          placeholder={t('descriptionHelp')}
                          value={tempQuestion.description}
                          onChange={(e) =>
                            setTempQuestion({
                              ...tempQuestion,
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddQuestion(false)}
                      >
                        {tCommon('cancel')}
                      </Button>
                      <Button type="button" onClick={handleAddQuestion}>
                        {t('addQuestion')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <FileText className="h-12 w-12 mb-4" />
                  <p className="font-medium">{t('noQuestions')}</p>
                  <p className="text-sm">{t('noQuestionsHelp')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  {Object.entries(groupedQuestions).map(([section, sectionQuestions]) => (
                    <div key={section} className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 sticky top-0 bg-background py-2">
                        {section}
                      </h3>
                      <div className="space-y-3">
                        {sectionQuestions.map((question) => (
                          <div
                            key={question.id}
                            className="flex items-start gap-3 rounded-lg border p-3 group"
                          >
                            <div className="cursor-move text-muted-foreground">
                              <GripVertical className="h-5 w-5" />
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {question.question_code}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium">{question.question_text}</p>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Badge variant="secondary">{question.type}</Badge>
                                {question.is_required && (
                                  <span className="text-red-500">{t('required')}</span>
                                )}
                                {question.options && question.options.length > 0 && (
                                  <span>{question.options.length} {t('options').toLowerCase()}</span>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => remove(question.index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              )}

              {form.formState.errors.questions && (
                <p className="text-sm text-destructive mt-2">
                  {form.formState.errors.questions.message}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('creating') : t('createSurvey')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
