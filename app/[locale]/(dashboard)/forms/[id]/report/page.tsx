'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Printer } from 'lucide-react'

interface Question {
  question_code: string
  question_text: string
  type: string
  section_name: string | null
}

interface ResponseData {
  answers: Record<string, string | string[]>
}

interface ReportData {
  survey: {
    title: string
    description: string | null
    company_name: string
  }
  questions: Question[]
  responses: ResponseData[]
  stats: {
    total_assigned: number
    total_completed: number
    completion_rate: number
  }
}

// Scale value mappings
const scaleValueMap: Record<string, number> = {
  'Санал бүрэн нийлж байна': 5,
  'Ерөнхийдөө санал нийлж байна': 4,
  'Эргэлзэж байна 50/50': 3,
  'Ерөнхийдөө санал нийлэхгүй байна': 2,
  'Санал огт нийлэхгүй байна': 1,
  'Strongly Agree': 5,
  'Agree': 4,
  'Neutral': 3,
  'Disagree': 2,
  'Strongly Disagree': 1,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
  '1': 1,
}

function getScaleValue(answer: string): number | null {
  if (!answer) return null
  const num = parseFloat(answer)
  if (!isNaN(num) && num >= 1 && num <= 5) return num
  return scaleValueMap[answer.trim()] || null
}

function calculateStats(
  questionCode: string,
  questionType: string,
  responses: ResponseData[]
): { average: number | null; distribution: Record<string, number>; total: number } {
  const answers = responses
    .map((r) => r.answers[questionCode])
    .filter((a) => a !== undefined && a !== null && a !== '')

  const total = answers.length
  const distribution: Record<string, number> = {}

  if (questionType === 'scale' || questionType === 'rating') {
    let sum = 0
    let count = 0

    answers.forEach((answer) => {
      const strAnswer = String(answer)
      const value = getScaleValue(strAnswer)
      if (value !== null) {
        sum += value
        count++
      }
      distribution[strAnswer] = (distribution[strAnswer] || 0) + 1
    })

    return {
      average: count > 0 ? Math.round((sum / count) * 100) / 100 : null,
      distribution,
      total,
    }
  }

  answers.forEach((answer) => {
    const strAnswer = Array.isArray(answer) ? answer.join(', ') : String(answer)
    distribution[strAnswer] = (distribution[strAnswer] || 0) + 1
  })

  return { average: null, distribution, total }
}

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const surveyId = params.id as string
  const t = useTranslations('Report')

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/surveys/${surveyId}/report-data`)
        if (!response.ok) {
          throw new Error('Failed to fetch report data')
        }
        const reportData = await response.json()
        setData(reportData)

        // Auto-trigger print dialog after data loads
        setTimeout(() => {
          window.print()
        }, 500)
      } catch (err) {
        setError('Failed to load report data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [surveyId])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-red-500">{error || 'No data available'}</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }

  // Group questions by section
  const sections: Record<string, Question[]> = {}
  data.questions.forEach((q) => {
    const section = q.section_name || 'Ерөнхий'
    if (!sections[section]) sections[section] = []
    sections[section].push(q)
  })

  // Calculate section averages
  const sectionAverages: Record<string, { avg: number; count: number }> = {}
  Object.entries(sections).forEach(([sectionName, questions]) => {
    const scaleQuestions = questions.filter((q) => q.type === 'scale' || q.type === 'rating')
    let totalAvg = 0
    let avgCount = 0

    scaleQuestions.forEach((q) => {
      const stats = calculateStats(q.question_code, q.type, data.responses)
      if (stats.average !== null) {
        totalAvg += stats.average
        avgCount++
      }
    })

    if (avgCount > 0) {
      sectionAverages[sectionName] = {
        avg: Math.round((totalAvg / avgCount) * 100) / 100,
        count: scaleQuestions.length,
      }
    }
  })

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1.5cm;
            size: A4;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          h2, h3 {
            page-break-after: avoid;
          }
        }
      `}</style>

      {/* Header with close and print buttons */}
      <div className="no-print p-4 border-b bg-background sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => window.close()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('close')}
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            {t('print')}
          </Button>
        </div>
      </div>

      {/* Report content */}
      <div className="print-area p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
          <h2 className="text-xl mb-1">{data.survey.title}</h2>
          <p className="text-gray-600">{data.survey.company_name}</p>
          <p className="text-sm text-gray-500 mt-2">
            {t('date')}: {new Date().toLocaleDateString('mn-MN')}
          </p>
        </div>

        {/* Statistics */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">{t('statisticsTitle')}</h3>
          <table className="w-full border-collapse border border-gray-300 mb-4">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-gray-300 bg-gray-50 font-medium w-1/2">
                  {t('totalParticipants')}
                </td>
                <td className="p-2 text-center">{data.stats.total_assigned}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-2 border-r border-gray-300 bg-gray-50 font-medium">
                  {t('completed')}
                </td>
                <td className="p-2 text-center">{data.stats.total_completed}</td>
              </tr>
              <tr>
                <td className="p-2 border-r border-gray-300 bg-gray-50 font-medium">
                  {t('completionRate')}
                </td>
                <td className="p-2 text-center font-semibold">{data.stats.completion_rate}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section Summary */}
        {Object.keys(sectionAverages).length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 border-b pb-2">{t('responseDistribution')}</h3>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border border-gray-300 text-left">{t('sectionTitle')}</th>
                  <th className="p-2 border border-gray-300 text-center w-24">{t('questionCode')}</th>
                  <th className="p-2 border border-gray-300 text-center w-24">{t('average')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sectionAverages).map(([section, { avg, count }]) => (
                  <tr key={section} className="border-b border-gray-300">
                    <td className="p-2 border-r border-gray-300">{section}</td>
                    <td className="p-2 border-r border-gray-300 text-center">{count}</td>
                    <td className="p-2 text-center font-semibold">{avg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed Results by Section */}
        <div>
          <h3 className="text-lg font-semibold mb-3 border-b pb-2">{t('responseDistribution')}</h3>

          {Object.entries(sections).map(([sectionName, questions]) => (
            <div key={sectionName} className="mb-6">
              <h4 className="font-semibold bg-gray-100 p-2 mb-2">{sectionName}</h4>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 border border-gray-300 text-left w-16">{t('questionCode')}</th>
                    <th className="p-2 border border-gray-300 text-left">{t('question')}</th>
                    <th className="p-2 border border-gray-300 text-center w-20">{t('responses')}</th>
                    <th className="p-2 border border-gray-300 text-center w-20">{t('average')}</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const stats = calculateStats(q.question_code, q.type, data.responses)
                    return (
                      <tr key={q.question_code} className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 font-mono text-xs">
                          {q.question_code}
                        </td>
                        <td className="p-2 border-r border-gray-300">{q.question_text}</td>
                        <td className="p-2 border-r border-gray-300 text-center">{stats.total}</td>
                        <td className="p-2 text-center font-semibold">
                          {stats.average !== null ? stats.average.toFixed(2) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
          <p>Энэхүү тайлан нь Employee Feedback System-ээс автоматаар үүсгэгдсэн болно.</p>
        </div>
      </div>
    </>
  )
}
