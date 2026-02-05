'use client'

import { useCallback, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useTranslations } from 'next-intl'

export interface ParsedRow {
  rowNumber: number
  employee_id: string
  full_name: string
  email: string
  org_unit_name: string
  phone_number?: string
  data: Record<string, string>
  errors: string[]
  warnings: string[]
}

export interface ParsedExcelData {
  headers: string[]
  rows: ParsedRow[]
  summary: {
    total: number
    valid: number
    invalid: number
    duplicates: number
  }
  orgUnits: string[]
  fileName: string
  sheetName?: string
}

interface UploadStepProps {
  onDataParsed: (data: ParsedExcelData) => void
  existingData?: ParsedExcelData | null
}

export function UploadStep({ onDataParsed, existingData }: UploadStepProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(existingData || null)

  const t = useTranslations('Import')

  const parseExcelFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      // Send file to API for server-side parsing and validation
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/employees/parse-excel', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || t('errors.parseError'))
      }

      const data: ParsedExcelData = {
        ...result.data,
        headers: result.data.columns || result.data.headers || [], // Handle both keys
        fileName: file.name,
        sheetName: result.data.sheetName || 'Sheet1',
      }

      setParsedData(data)
      onDataParsed(data)
    } catch (err) {
      console.error('Error parsing Excel:', err)
      setError(err instanceof Error ? err.message : t('errors.parseError'))
    } finally {
      setIsLoading(false)
    }
  }, [onDataParsed, t])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        setError(t('errors.invalidFormat'))
        return
      }
      parseExcelFile(file)
    }
  }, [parseExcelFile, t])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      parseExcelFile(file)
    }
  }, [parseExcelFile])

  const handleRemoveFile = useCallback(() => {
    setParsedData(null)
    setError(null)
  }, [])

  if (parsedData) {
    const { summary } = parsedData
    const hasErrors = summary.invalid > 0
    const hasWarnings = summary.duplicates > 0

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium">{parsedData.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {t('rowCount', { count: parsedData.rows.length })} &bull; {t('columnCount', { count: parsedData.headers.length })}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Validation Summary */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="p-3 bg-secondary rounded-lg text-center">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">{t('total')}</p>
            </div>
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-center">
              <p className="text-2xl font-bold">{summary.valid}</p>
              <p className="text-xs">{t('valid')}</p>
            </div>
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-center">
              <p className="text-2xl font-bold">{summary.invalid}</p>
              <p className="text-xs">{t('invalid')}</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-lg text-center">
              <p className="text-2xl font-bold">{summary.duplicates}</p>
              <p className="text-xs">{t('duplicates')}</p>
            </div>
          </div>

          {/* Error/Warning Messages */}
          {(hasErrors || hasWarnings) && (
            <div className="mt-4 space-y-2">
              {hasErrors && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('validationErrors')}</p>
                    <p className="text-xs mt-1">{t('reviewErrors')}</p>
                  </div>
                </div>
              )}
              {hasWarnings && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t('duplicatesFound')}</p>
                    <p className="text-xs mt-1">{t('reviewDuplicates')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="text-sm font-medium mb-2">{t('detectedColumns')}</p>
            <div className="flex flex-wrap gap-2">
              {parsedData.headers.map((header, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>

          {/* Org Units Found */}
          {parsedData.orgUnits && parsedData.orgUnits.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">{t('orgUnitsFound', { count: parsedData.orgUnits.length })}</p>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-auto">
                {parsedData.orgUnits.slice(0, 20).map((unit, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-sm"
                  >
                    {unit}
                  </span>
                ))}
                {parsedData.orgUnits.length > 20 && (
                  <span className="px-2 py-1 text-sm text-muted-foreground">
                    +{parsedData.orgUnits.length - 20} more
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
            isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            isLoading && 'opacity-50 pointer-events-none'
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('dragDropTitle')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('dragDropSubtitle')}
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="excel-upload"
          />
          <Button asChild variant="outline" disabled={isLoading}>
            <label htmlFor="excel-upload" className="cursor-pointer">
              {isLoading ? t('parsing') : t('selectFile')}
            </label>
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
