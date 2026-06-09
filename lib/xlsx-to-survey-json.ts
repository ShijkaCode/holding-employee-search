import * as XLSX from 'xlsx'
import { SurveyExportJSON, SurveyExportQuestion, SurveyExportResponse, SurveyExportAnswer, Enums } from '@/types/database'
import { randomUUID } from 'crypto'

type QuestionType = Enums<'question_type'>
type ValueType = SurveyExportAnswer['value_type']

// Mongolian Likert scale phrases → numeric mapping
const LIKERT_PHRASES: Record<string, string> = {
  'Санал бүрэн нийлж байна': '5',
  'Ерөнхийдөө санал нийлж байна': '4',
  'Эргэлзэж байна 50/50': '3',
  'Санал нийлэхгүй талдаа байна': '2',
  'Санал огт нийлэхгүй байна': '1',
  'Мэдэхгүй': '0',
}

// Columns that are metadata, not questions
const META_COLUMNS = new Set([
  'company name', 'start time', 'completion time', 'email', 'name',
  'id', 'respondent', 'timestamp', 'date', 'submitted',
])

// Columns that are demographics, not survey questions
const DEMOGRAPHIC_COLUMNS = new Set([
  'group', 'years', 'birthyear', 'gender', 'age', 'department',
  'position', 'tenure', 'location', 'education',
])

interface InferredColumn {
  code: string
  text: string
  type: QuestionType
  valueType: ValueType
  section: string | null
  options: string[] | null
  isDemographic: boolean
  isMeta: boolean
}

/**
 * Normalizes a Likert phrase by trimming whitespace and trailing spaces
 */
function normalizeLikert(val: string): string | null {
  const trimmed = val.trim()
  for (const phrase of Object.keys(LIKERT_PHRASES)) {
    if (trimmed.startsWith(phrase)) return phrase
  }
  return null
}

/**
 * Infers the question type from a column's actual values
 */
function inferColumnType(
  header: string,
  values: (string | number | null | undefined)[]
): { type: QuestionType; valueType: ValueType; options: string[] | null } {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '')

  if (nonEmpty.length === 0) {
    return { type: 'text', valueType: 'text', options: null }
  }

  // Check if all values are numeric
  const allNumeric = nonEmpty.every(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v.trim()))))
  if (allNumeric) {
    const nums = nonEmpty.map(v => typeof v === 'number' ? v : Number(String(v).trim()))
    const min = Math.min(...nums)
    const max = Math.max(...nums)

    if (min >= 1 && max <= 5) return { type: 'scale', valueType: 'numeric', options: null }
    if (min >= 1 && max <= 10) return { type: 'rating', valueType: 'numeric', options: null }
    // Wider numeric range — still treat as rating
    return { type: 'rating', valueType: 'numeric', options: null }
  }

  // Check if values are Mongolian Likert phrases
  const stringVals = nonEmpty.map(v => String(v))
  const likertMatches = stringVals.filter(v => normalizeLikert(v) !== null)
  if (likertMatches.length / stringVals.length > 0.7) {
    return { type: 'scale', valueType: 'numeric', options: null }
  }

  // Check for comma-separated multi-select values (e.g. "Яриа, Үйлдэл")
  const hasCommaValues = stringVals.some(v => v.includes(', ') && v.split(', ').length <= 5)
  const uniqueFlat = new Set<string>()
  stringVals.forEach(v => {
    if (v.includes(', ')) {
      v.split(', ').forEach(part => uniqueFlat.add(part.trim()))
    } else {
      uniqueFlat.add(v.trim())
    }
  })

  if (hasCommaValues && uniqueFlat.size <= 15) {
    return { type: 'multiple_choice', valueType: 'multi_selection', options: [...uniqueFlat] }
  }

  // Check unique count for single choice
  const uniqueVals = new Set(stringVals.map(v => v.trim()))
  if (uniqueVals.size <= 10) {
    return { type: 'single_choice', valueType: 'selection', options: [...uniqueVals] }
  }

  // Default: free text
  return { type: 'text', valueType: 'text', options: null }
}

/**
 * Tries to find a questionnaire/dictionary sheet that maps codes to full question text.
 * Returns a Map<questionCode, { text, section }> if found.
 */
function parseQuestionnaireSheet(
  workbook: XLSX.WorkBook,
  dataSheetName: string
): Map<string, { text: string; section: string | null }> | null {
  const map = new Map<string, { text: string; section: string | null }>()

  // Find a sheet that isn't the data sheet
  const otherSheets = workbook.SheetNames.filter(n => n !== dataSheetName)
  if (otherSheets.length === 0) return null

  for (const sheetName of otherSheets) {
    const ws = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 })

    let currentSection: string | null = null
    let foundCodes = 0

    for (const row of rows) {
      if (!row || row.length === 0) continue

      const col0 = row[0] != null ? String(row[0]).trim() : ''
      const col1 = row[1] != null ? String(row[1]).trim() : ''

      // Pattern: code in col0 (e.g. "1.Q1"), question text in col1
      if (/^\d+\.Q\d+/.test(col0) && col1) {
        map.set(col0, { text: col1, section: currentSection })
        foundCodes++
      }
      // Pattern: demographic codes like "Group", "Years", "Gender"
      else if (col0 && col1 && !col0.includes(' ') && col0.length < 20) {
        map.set(col0, { text: col1, section: currentSection })
      }
      // Section header: only col0 or col1 has text, looks like a title
      else if ((col0 && !col1) || (!col0 && col1)) {
        const title = col0 || col1
        if (title.length > 2 && title.length < 200) {
          currentSection = title
        }
      }
    }

    if (foundCodes > 0) return map
  }

  return null
}

/**
 * Finds the data sheet — the one with the most columns (the response matrix)
 */
function findDataSheet(workbook: XLSX.WorkBook): string {
  let bestSheet = workbook.SheetNames[0]
  let maxCols = 0

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    if (!ws['!ref']) continue
    const range = XLSX.utils.decode_range(ws['!ref'])
    const cols = range.e.c + 1
    if (cols > maxCols) {
      maxCols = cols
      bestSheet = name
    }
  }

  return bestSheet
}

/**
 * Converts an Excel serial date number to ISO string
 */
function excelDateToISO(serial: number): string {
  const epoch = new Date(1899, 11, 30)
  const date = new Date(epoch.getTime() + serial * 86400000)
  return date.toISOString()
}

/**
 * Converts a Likert text value to its numeric equivalent, or returns the original value
 */
function convertLikertValue(val: string | number | null | undefined): string | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return String(val)

  const str = String(val)
  const likertKey = normalizeLikert(str)
  if (likertKey) return LIKERT_PHRASES[likertKey]

  return str.trim()
}

export interface XlsxParseOptions {
  /** Title for the survey (defaults to filename) */
  title?: string
  /** Description */
  description?: string
  /** Callback URL for sentiment results */
  callbackUrl: string
  /** Pre-generated analysis ID (generated if not provided) */
  analysisId?: string
}

/**
 * Parses an xlsx Buffer into the standard SurveyExportJSON format.
 * Automatically infers question types from the data.
 */
export function parseXlsxToSurveyJSON(
  buffer: Buffer,
  options: XlsxParseOptions
): SurveyExportJSON {
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const dataSheetName = findDataSheet(workbook)
  const ws = workbook.Sheets[dataSheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 })

  if (rows.length < 2) {
    throw new Error('File must have at least a header row and one data row')
  }

  const headers = rows[0].map(h => (h != null ? String(h).trim() : ''))
  const dataRows = rows.slice(1).filter(row => row.some(cell => cell != null && cell !== ''))

  // Try to find question text from a secondary sheet
  const questionDict = parseQuestionnaireSheet(workbook, dataSheetName)

  // Analyze each column
  const columns: InferredColumn[] = headers.map((header, colIdx) => {
    const headerLower = header.toLowerCase()
    const isMeta = META_COLUMNS.has(headerLower)
    const isDemographic = DEMOGRAPHIC_COLUMNS.has(headerLower)

    const colValues = dataRows.map(row => row[colIdx] as string | number | null | undefined)
    const { type, valueType, options: inferredOptions } = inferColumnType(header, colValues)

    // Get question text from dictionary sheet, or use header as-is
    const dictEntry = questionDict?.get(header)
    const text = dictEntry?.text || header
    const section = dictEntry?.section || null

    return {
      code: header,
      text,
      type,
      valueType,
      section,
      options: inferredOptions,
      isDemographic,
      isMeta,
    }
  })

  // Build questions array (exclude meta columns)
  const questionColumns = columns.filter(c => !c.isMeta)
  const exportQuestions: SurveyExportQuestion[] = questionColumns.map(col => ({
    code: col.code,
    text: col.text,
    type: col.type,
    section: col.isDemographic ? 'Demographics' : col.section,
    options: col.options,
  }))

  // Build responses
  const exportResponses: SurveyExportResponse[] = dataRows.map((row, rowIdx) => {
    // Try to extract submission time from meta columns
    const completionIdx = headers.findIndex(h => h.toLowerCase() === 'completion time')
    const startIdx = headers.findIndex(h => h.toLowerCase() === 'start time')
    const timeIdx = completionIdx !== -1 ? completionIdx : startIdx
    let submittedAt: string | null = null
    if (timeIdx !== -1 && row[timeIdx] != null) {
      const timeVal = row[timeIdx]
      if (typeof timeVal === 'number') {
        submittedAt = excelDateToISO(timeVal)
      } else {
        submittedAt = String(timeVal)
      }
    }

    const answers: SurveyExportAnswer[] = questionColumns.map(col => {
      const colIdx = headers.indexOf(col.code)
      const rawValue = row[colIdx]

      let value: string | string[] | null = null

      if (rawValue === null || rawValue === undefined || rawValue === '') {
        value = null
      } else if (col.type === 'scale') {
        value = convertLikertValue(rawValue)
      } else if (col.type === 'multiple_choice' && typeof rawValue === 'string' && rawValue.includes(', ')) {
        value = rawValue.split(', ').map(v => v.trim())
      } else if (typeof rawValue === 'number') {
        value = String(rawValue)
      } else {
        value = String(rawValue).trim()
      }

      return {
        question_code: col.code,
        question_type: col.type,
        value,
        value_type: col.valueType,
      }
    })

    return {
      id: `xlsx-row-${rowIdx + 1}`,
      submitted_at: submittedAt,
      answers,
    }
  })

  const analysisId = options.analysisId || randomUUID()

  return {
    survey: {
      id: `xlsx-import-${analysisId}`,
      title: options.title || dataSheetName,
      description: options.description || `Imported from xlsx file (${dataRows.length} responses)`,
      created_at: new Date().toISOString(),
    },
    questions: exportQuestions,
    responses: exportResponses,
    metadata: {
      total_responses: exportResponses.length,
      export_date: new Date().toISOString(),
      callback_url: options.callbackUrl,
      analysis_id: analysisId,
    },
  }
}
