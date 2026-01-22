import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Question {
  question_code: string
  question_text: string
  type: string
  section_name: string | null
}

interface ResponseData {
  answers: Record<string, string | string[]>
}

interface SurveyReportData {
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

// Scale value mappings for Mongolian responses
const scaleValueMap: Record<string, number> = {
  'Санал бүрэн нийлж байна': 5,
  'Ерөнхийдөө санал нийлж байна': 4,
  'Эргэлзэж байна 50/50': 3,
  'Ерөнхийдөө санал нийлэхгүй байна': 2,
  'Санал огт нийлэхгүй байна': 1,
  // English alternatives
  'Strongly Agree': 5,
  'Agree': 4,
  'Neutral': 3,
  'Disagree': 2,
  'Strongly Disagree': 1,
  // Simple scale
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
  '1': 1,
}

function getScaleValue(answer: string): number | null {
  if (!answer) return null
  // Direct number
  const num = parseFloat(answer)
  if (!isNaN(num) && num >= 1 && num <= 5) return num
  // Mapped value
  return scaleValueMap[answer.trim()] || null
}

function calculateQuestionStats(
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
      // Count distribution
      distribution[strAnswer] = (distribution[strAnswer] || 0) + 1
    })

    return {
      average: count > 0 ? Math.round((sum / count) * 100) / 100 : null,
      distribution,
      total,
    }
  }

  // For non-scale questions, just count distribution
  answers.forEach((answer) => {
    const strAnswer = Array.isArray(answer) ? answer.join(', ') : String(answer)
    distribution[strAnswer] = (distribution[strAnswer] || 0) + 1
  })

  return { average: null, distribution, total }
}

export function generateSurveyReport(data: SurveyReportData): jsPDF {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Survey Report', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // Survey info
  doc.setFontSize(14)
  doc.text(data.survey.title, pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Company: ${data.survey.company_name}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 6

  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  // Stats summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Response Statistics', 14, yPos)
  yPos += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Total Assigned', String(data.stats.total_assigned)],
      ['Total Completed', String(data.stats.total_completed)],
      ['Completion Rate', `${data.stats.completion_rate}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [66, 66, 66] },
    margin: { left: 14, right: 14 },
    tableWidth: 80,
  })

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15

  // Group questions by section
  const sections: Record<string, Question[]> = {}
  data.questions.forEach((q) => {
    const section = q.section_name || 'General'
    if (!sections[section]) sections[section] = []
    sections[section].push(q)
  })

  // Results by section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Results by Section', 14, yPos)
  yPos += 10

  // Section summary table
  const sectionSummary: string[][] = []

  Object.entries(sections).forEach(([sectionName, questions]) => {
    const scaleQuestions = questions.filter((q) => q.type === 'scale' || q.type === 'rating')
    if (scaleQuestions.length > 0) {
      let totalAvg = 0
      let avgCount = 0

      scaleQuestions.forEach((q) => {
        const stats = calculateQuestionStats(q.question_code, q.type, data.responses)
        if (stats.average !== null) {
          totalAvg += stats.average
          avgCount++
        }
      })

      const sectionAvg = avgCount > 0 ? (totalAvg / avgCount).toFixed(2) : 'N/A'
      sectionSummary.push([sectionName, String(scaleQuestions.length), sectionAvg])
    }
  })

  if (sectionSummary.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Section', 'Questions', 'Avg Score']],
      body: sectionSummary,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
  }

  // Detailed results per question
  doc.addPage()
  yPos = 20

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Detailed Question Results', 14, yPos)
  yPos += 10

  Object.entries(sections).forEach(([sectionName, questions]) => {
    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(sectionName, 14, yPos)
    yPos += 8

    const questionResults: string[][] = []

    questions.forEach((q) => {
      const stats = calculateQuestionStats(q.question_code, q.type, data.responses)
      const avgStr = stats.average !== null ? stats.average.toFixed(2) : '-'

      // Truncate question text for table
      const truncatedText = q.question_text.length > 60
        ? q.question_text.substring(0, 57) + '...'
        : q.question_text

      questionResults.push([
        q.question_code,
        truncatedText,
        q.type,
        String(stats.total),
        avgStr,
      ])
    })

    autoTable(doc, {
      startY: yPos,
      head: [['Code', 'Question', 'Type', 'Responses', 'Avg']],
      body: questionResults,
      theme: 'striped',
      headStyles: { fillColor: [100, 100, 100], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 90 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
      },
      margin: { left: 14, right: 14 },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  })

  return doc
}

export function downloadPdf(doc: jsPDF, filename: string): void {
  doc.save(filename)
}
